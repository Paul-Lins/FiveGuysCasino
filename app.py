from flask import Flask, request, jsonify, send_from_directory, session, redirect
from werkzeug.security import check_password_hash, generate_password_hash
from bson import ObjectId
import os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "cs485-class-demo-key")

# MONGODB CONNECTION
# Import MongoClient from pymongo.
# Connect to mongodb://localhost:27017/
# Database: Five_Guys_Casino
# Collection: users
# Create users_collection.
from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017/")
db = client["Five_Guys_Casino"]
users_collection = db["users"]
ADMIN_GAMES = {"Blackjack", "Roulette", "Slots", "Coin Flip"}


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
