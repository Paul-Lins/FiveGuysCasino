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
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const credentials = {
        email: email,
        password: password
    };

    const response = await fetch("/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (!response.ok) {
        message.textContent = data.error;
        message.style.color = "red";

        document.getElementById("email").classList.add("input-error");
        document.getElementById("password").classList.add("input-error");

        return;
    }

    if (data.role === "admin") {
        window.location.href = "/admin";
    } else {
        window.location.href = "/user";
    }
});


// Create an account
const createAccountButton = document.getElementById("createAccountButton");
createAccountButton.addEventListener("click", async () => {
    if (!form.reportValidity()) {
        return;
    }

    message.textContent = "";
    createAccountButton.disabled = true;

    const credentials = {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value.trim()
    };

    try {
        const response = await fetch("/api/create-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Account creation failed.");
        }

        window.location.href = data.role === "admin" ? "/admin" : "/user";
    } catch (error) {
        message.textContent = error.message || "Could not create the account. Please try again.";
        message.style.color = "red";
    } finally {
        createAccountButton.disabled = false;
    }
});