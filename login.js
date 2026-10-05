const form = document.getElementById("loginForm");
const message = document.getElementById("message");

/*
TODO 1 - FRONTEND LOGIN

When the form is submitted:
1. Prevent page reload.
2. Read email and password.
3. Create an object.
4. POST JSON to /api/login.
5. Convert the response to JSON.
6. If login fails, show the error.
7. If role is "admin", go to /admin.
8. If role is "user", go to /user.
*/
form.addEventListener("submit", async event => {
    // WRITE YOUR CODE HERE
    event.preventDefault();
    const email = document.getElementById("email").value.trim()
    const password = document.getElementById("password").value.trim()
    const credentials = {
        email: email,
        password: password
    };
    const response = await fetch ("/api/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
    });
    const data = await response.json();
    
    if (!response.ok) {
    // display data.error
    throw new Error("Login failed: " + data.error);
    }

    if (data.role === "admin"){
        window.location.href = "/admin";
    } else {
        window.location.href = "/user"
    }

});