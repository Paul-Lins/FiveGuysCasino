from flask import Flask, request, jsonify, send_from_directory, session, redirect
from werkzeug.security import check_password_hash
import os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "cs485-class-demo-key")

# MONGODB CONNECTION
# Import MongoClient from pymongo.
# Connect to mongodb://localhost:27017/
# Database: coffee_auth
# Collection: users
# Create users_collection.
from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017/")
db = client["coffee_auth"]
users_collection = db["users"]

@app.get("/")
def login_page():
    return send_from_directory(".", "login.html")

@app.get("/style.css")
def stylesheet():
    return send_from_directory(".", "style.css")

@app.get("/login.js")
def login_javascript():
    return send_from_directory(".", "login.js")

@app.get("/dashboard.js")
def dashboard_javascript():
    return send_from_directory(".", "dashboard.js")


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
        return jsonify({"error": "Invalid email or password"})

    # Save user info in the session
    session["user_id"] = str(user["_id"])
    session["name"] = user["name"]
    session["email"] = user["email"]
    session["role"] = user["role"]

    # Return name, email, role as JSON
    return jsonify({"name": user["name"], "email": user["email"], "role": user["role"]}), 200

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
    


# POST /api/logout
# Clear the session and return JSON.
@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

if __name__ == "__main__":
    print("Open: http://localhost:5000")
    app.run(debug=True)
