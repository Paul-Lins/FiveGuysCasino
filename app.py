from flask import Flask, request, jsonify, send_from_directory, session, redirect
from werkzeug.security import check_password_hash, generate_password_hash
from bson import ObjectId
import os
import random
import uuid

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "cs485-class-demo-key")

# MONGODB CONNECTION
# Import MongoClient from pymongo.
# Connect to mongodb://localhost:27017/
# Database: Five_Guys_Casino
# Collection: users
# Create users_collection.
from pymongo import MongoClient, ReturnDocument
client = MongoClient("mongodb://localhost:27017/")
db = client["Five_Guys_Casino"]
users_collection = db["users"]
ADMIN_GAMES = {"Blackjack", "Roulette"}


def admin_auth_error():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403
    return None

@app.get("/")
def login_page():
    return send_from_directory(".", "login.html")

@app.get("/style.css")
def stylesheet():
    return send_from_directory(".", "style.css")

@app.get("/login.js")
def login_javascript():
    return send_from_directory(".", "login.js")

@app.get("/app.js")
def app_javascript():
    return send_from_directory(".", "app.js")


# POST /api/login
# Read email and password from JSON.
# Find the account in MongoDB by email.
# Make sure active is True.
# Validate with check_password_hash().
# Save user_id, name, email, role in session.
# Return name, email, role as JSON.
@app.post("/api/login")
def login():
    # read the email and password from json
    data = request.get_json() or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    #find the account in mongo by email
    user = users_collection.find_one({"email": email})

    # make sure the account exists, is active and the password matches
    if not user or not user.get("active") or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Save user info in the session
    session["user_id"] = str(user["_id"])
    session["name"] = user["name"]
    session["email"] = user["email"]
    session["role"] = user["role"]

    # Return name, email, role as JSON
    return jsonify({"name": user["name"], "email": user["email"], "role": user["role"]}), 200

@app.post("/api/create-account")
def create_account():
    # read the email and password from json
    data = request.get_json() or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # check if the email already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 400

    # create a new user document
    new_user = {
        "name": email.split("@")[0],  # Use the part before @ as name
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": "user",  # Default role is user
        "active": True,
        "balance": 0,
        "winnings": 0,
        "profit": 0,
        "blocked_games": []
    }
    users_collection.insert_one(new_user)

    # Save user info in the session
    session["user_id"] = str(new_user["_id"])
    session["name"] = new_user["name"]
    session["email"] = new_user["email"]
    session["role"] = new_user["role"]

    # Return name, email, role as JSON
    return jsonify({"name": new_user["name"], "email": new_user["email"], "role": new_user["role"]}), 201


# GET /api/me
# If not logged in, return 401.
# Otherwise return name, email, role.
@app.get("/api/me")
def current_user():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    return jsonify({
        "name": session["name"],
        "email": session["email"],
        "role": session["role"]
    }), 200
    
@app.get("/api/balance")
def get_balance():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    user = users_collection.find_one({"_id": ObjectId(session["user_id"])})
    return jsonify({"balance": user.get("balance", 0) if user else 0}), 200


@app.get("/api/game-access")
def get_game_access():
    if "user_id" not in session or session.get("role") != "user":
        return jsonify({"error": "Not authenticated"}), 401
    user = users_collection.find_one(
        {"_id": ObjectId(session["user_id"]), "active": True},
        {"blocked_games": 1}
    )
    if not user:
        return jsonify({"error": "Player account is unavailable"}), 404
    return jsonify({"blocked_games": user.get("blocked_games", [])}), 200


@app.post("/api/games/wager")
def place_game_wager():
    if "user_id" not in session or session.get("role") != "user":
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json(silent=True) or {}
    game = data.get("game")
    amount = data.get("amount")
    choice = data.get("choice")
    if not isinstance(game, str) or game not in {"Blackjack", "Roulette"}:
        return jsonify({"error": "Invalid game"}), 400
    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0 or amount > 9007199254740991:
        return jsonify({"error": "Wager must be a positive whole number"}), 400
    if game == "Roulette" and (not isinstance(choice, str) or choice not in {"red", "black", "green"}):
        return jsonify({"error": "Choose a valid roulette color"}), 400

    bet_id = uuid.uuid4().hex
    pending_bet = {"id": bet_id, "game": game, "amount": amount}
    roulette_result = None
    if game == "Roulette":
        roulette_result = random.randrange(38)
        result_color = (
            "green" if roulette_result in {0, 37}
            else "red" if roulette_result in {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
            else "black"
        )
        pending_bet.update({"choice": choice, "result": roulette_result, "result_color": result_color})

    user_filter = {
        "_id": ObjectId(session["user_id"]),
        "role": "user",
        "active": True,
        "blocked_games": {"$ne": game},
        "balance": {"$gte": amount}
    }
    user = users_collection.find_one_and_update(
        user_filter,
        {"$inc": {"balance": -amount}, "$push": {"pending_bets": pending_bet}},
        return_document=ReturnDocument.AFTER
    )
    if not user:
        existing_user = users_collection.find_one({"_id": ObjectId(session["user_id"])})
        if not existing_user or not existing_user.get("active", False):
            return jsonify({"error": "Player account is unavailable"}), 404
        if game in existing_user.get("blocked_games", []):
            return jsonify({"error": f"Access to {game} is restricted"}), 403
        return jsonify({"error": "Insufficient balance for this wager"}), 400

    response = {"bet_id": bet_id, "balance": user.get("balance", 0)}
    if roulette_result is not None:
        response["result"] = "00" if roulette_result == 37 else roulette_result
        response["result_color"] = result_color
    return jsonify(response), 201


@app.post("/api/games/settle")
def settle_game_wager():
    if "user_id" not in session or session.get("role") != "user":
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json(silent=True) or {}
    bet_id = data.get("bet_id")
    if not isinstance(bet_id, str) or not bet_id:
        return jsonify({"error": "A valid bet ID is required"}), 400

    player_id = ObjectId(session["user_id"])
    settled_user = users_collection.find_one({"_id": player_id, "settled_bets.id": bet_id})
    if settled_user:
        settlement = next(item for item in settled_user.get("settled_bets", []) if item.get("id") == bet_id)
        return jsonify({
            "balance": settled_user.get("balance", 0),
            "payout": settlement["payout"],
            "net_winnings": settlement["net_winnings"],
            "outcome": settlement["outcome"],
            "game": settlement.get("game", "Unknown")
        }), 200

    user = users_collection.find_one({"_id": player_id, "pending_bets.id": bet_id})
    if not user:
        return jsonify({"error": "Wager was already settled or not found"}), 409
    bet = next(item for item in user.get("pending_bets", []) if item.get("id") == bet_id)
    amount = bet["amount"]

    if bet["game"] == "Blackjack":
        outcome = data.get("outcome")
        payouts = {"win": amount * 2, "push": amount, "loss": 0}
        if outcome not in payouts:
            return jsonify({"error": "Invalid blackjack outcome"}), 400
        payout = payouts[outcome]
        settled_outcome = outcome
    else:
        won = bet["choice"] == bet["result_color"]
        payout = amount * (18 if bet["choice"] == "green" else 2) if won else 0
        settled_outcome = "win" if won else "loss"

    update = users_collection.find_one_and_update(
        {"_id": player_id, "pending_bets.id": bet_id},
        {
            "$inc": {
                "balance": payout,
                "winnings": max(0, payout - amount),
                "profit": amount - payout
            },
            "$pull": {"pending_bets": {"id": bet_id}},
            "$push": {
                "settled_bets": {
                    "$each": [{
                        "id": bet_id,
                        "game": bet["game"],
                        "amount": amount,
                        "payout": payout,
                        "net_winnings": payout - amount,
                        "outcome": settled_outcome
                    }]
                }
            }
        },
        return_document=ReturnDocument.AFTER
    )
    if not update:
        update = users_collection.find_one({"_id": player_id})
        settled = next((item for item in update.get("settled_bets", []) if item.get("id") == bet_id), None) if update else None
        if not settled:
            return jsonify({"error": "Wager was already settled"}), 409
        payout = settled["payout"]
        settled_outcome = settled["outcome"]

    return jsonify({
        "balance": update.get("balance", 0),
        "payout": payout,
        "net_winnings": payout - amount,
        "outcome": settled_outcome,
        "game": bet["game"]
    }), 200


@app.get("/api/game-history")
def get_game_history():
    if "user_id" not in session or session.get("role") != "user":
        return jsonify({"error": "Not authenticated"}), 401

    try:
        page = max(1, int(request.args.get("page", "1")))
    except ValueError:
        return jsonify({"error": "Page must be a positive integer"}), 400

    user = users_collection.find_one(
        {"_id": ObjectId(session["user_id"]), "active": True},
        {"settled_bets": 1}
    )
    if not user:
        return jsonify({"error": "Player account is unavailable"}), 404

    settled_bets = list(reversed(user.get("settled_bets", [])))
    total_bets = len(settled_bets)
    total_pages = max(1, (total_bets + 9) // 10)
    page = min(page, total_pages)
    start = (page - 1) * 10
    bets = settled_bets[start:start + 10]
    return jsonify({
        "bets": bets,
        "page": page,
        "total_pages": total_pages,
        "total_bets": total_bets
    }), 200


@app.get("/api/players")
def list_players():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    if session.get("role") == "user":
        user = users_collection.find_one(
            {"_id": ObjectId(session["user_id"]), "role": "user", "active": True},
            {"name": 1, "email": 1}
        )
        if not user:
            return jsonify({"error": "Player account is unavailable"}), 404
        return jsonify({
            "players": [{
                "id": str(user["_id"]),
                "name": user.get("name", ""),
                "email": user.get("email", "")
            }]
        }), 200

    if session.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403

    players = [
        {"id": str(u["_id"]), "name": u.get("name", ""), "email": u.get("email", "")}
        for u in users_collection.find({"role": "user", "active": True}).sort("name", 1)
    ]
    return jsonify({"players": players}), 200


@app.post("/api/add-funds")
def add_funds():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "user":
        return jsonify({"error": "Users can only add funds to their own account"}), 403

    amount = request.get_json(silent=True, force=False) or {}
    if isinstance(amount, dict):
        raw_amount = amount.get("amount")
    else:
        raw_amount = None

    if isinstance(raw_amount, bool) or not isinstance(raw_amount, int) or raw_amount <= 0:
        return jsonify({"error": "Amount must be a positive whole number"}), 400

    player_id = session["user_id"]
    result = users_collection.update_one(
        {"_id": ObjectId(player_id), "role": "user", "active": True},
        {"$inc": {"balance": raw_amount}}
    )
    if result.matched_count == 0:
        return jsonify({"error": "Player account is unavailable"}), 404

    player = users_collection.find_one({"_id": ObjectId(player_id)})
    return jsonify({"name": player.get("name", ""), "balance": player.get("balance", 0)}), 200


@app.get("/api/get-leaderboard")
def get_leaderboard():
    if "user_id" not in session:
        return jsonify ({"error": "Not authenticated"}), 401

    players = [
        {
            "name": player.get("name", ""),
            "score": player.get("winnings", 0)
        }
        for player in users_collection.find(
            {"role": "user", "active": True},
            {"name": 1, "winnings": 1}
        ).sort("winnings", -1).limit(10)
    ]
    return jsonify({"players": players}), 200

# GET /user
# Require login.
# Return user.html.
@app.get("/user")
def user_page():
    if "user_id" not in session:
        return redirect("/")
    return send_from_directory(".", "user.html")

# GET /admin
# Require login.
# Require session role == "admin".
# Normal users must receive 403.
# Return admin.html.
@app.get("/admin")
def admin_page():
    if "user_id" not in session:
        return redirect("/")
    if session.get("role") != "admin":
        return "Forbidden", 403
    return send_from_directory(".", "admin.html")


@app.get("/api/admin/players")
def admin_players():
    auth_error = admin_auth_error()
    if auth_error:
        return auth_error

    players = []
    total_winnings = 0
    total_profit = 0
    restricted_count = 0
    for user in users_collection.find({"role": "user"}).sort("name", 1):
        blocked_games = user.get("blocked_games", [])
        balance = user.get("balance", 0)
        winnings = user.get("winnings", 0)
        profit = user.get("profit", 0)
        total_winnings += winnings
        total_profit += profit
        restricted_count += bool(blocked_games)
        players.append({
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "balance": balance,
            "winnings": winnings,
            "profit": profit,
            "blocked": blocked_games
        })

    return jsonify({
        "players": players,
        "summary": {
            "player_count": len(players),
            "total_winnings": total_winnings,
            "total_profit": total_profit,
            "restricted_count": restricted_count
        }
    }), 200


@app.delete("/api/admin/players/<player_id>")
def delete_player(player_id):
    auth_error = admin_auth_error()
    if auth_error:
        return auth_error
    if not ObjectId.is_valid(player_id):
        return jsonify({"error": "Invalid player ID"}), 400

    result = users_collection.delete_one({
        "_id": ObjectId(player_id),
        "role": "user"
    })
    if result.deleted_count == 0:
        return jsonify({"error": "Player not found"}), 404
    return jsonify({"message": "Player deleted"}), 200


@app.patch("/api/admin/players/<player_id>/games")
def update_player_game_access(player_id):
    auth_error = admin_auth_error()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    game = data.get("game")
    enabled = data.get("enabled")
    if game not in ADMIN_GAMES or not isinstance(enabled, bool):
        return jsonify({"error": "A valid game and enabled boolean are required"}), 400
    if not ObjectId.is_valid(player_id):
        return jsonify({"error": "Invalid player ID"}), 400

    player_filter = {"_id": ObjectId(player_id), "role": "user"}
    if not users_collection.find_one(player_filter, {"_id": 1}):
        return jsonify({"error": "Player not found"}), 404

    update = {"$pull": {"blocked_games": game}} if enabled else {"$addToSet": {"blocked_games": game}}
    users_collection.update_one(player_filter, update)
    player = users_collection.find_one(player_filter)
    return jsonify({
        "id": str(player["_id"]),
        "name": player.get("name", ""),
        "email": player.get("email", ""),
        "balance": player.get("balance", 0),
        "winnings": player.get("winnings", 0),
        "profit": player.get("profit", 0),
        "blocked": player.get("blocked_games", [])
    }), 200
    


# POST /api/logout
# Clear the session and return JSON.
@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

if __name__ == "__main__":
    print("Open: http://localhost:5000")
    app.run(debug=True)
