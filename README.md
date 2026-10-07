# Five Guys Casino

Five Guys Final Project  
Logan Loch, Jason Blankenship, Troy Mitzel, Jack Miller, Paul Lins, Tyler Way

A Flask + MongoDB casino demo with role-based access (player and admin) and a vanilla HTML/CSS/JS frontend.

## Features

- Login and account creation (hashed passwords, session-based auth)
- Roles:
  - **User**: plays games, views balance, game history and leaderboard
  - **Admin**: views all players with balance and winnings, blocks/unblocks players from specific games
- Games: Blackjack and Roulette
- Chip balance on the player page, with an add-funds panel
- Leaderboard of top players by winnings
- Paginated game history (10 bets per page)

## Betting flow

Wagers are handled server-side so the balance cannot be edited from the browser.

1. `POST /api/games/wager` deducts the bet from the balance and stores it as a pending bet. For Roulette the server also spins the wheel (0-36 and `00`) and picks the result.
2. `POST /api/games/settle` pays out the pending bet, updates `balance`, `winnings` and `profit`, and moves it to `settled_bets`. Settling twice is idempotent.

Payouts (stake included): Blackjack win 2x, push 1x; Roulette red/black 2x, green 18x (17:1 plus stake).

## API

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/login` | Log in |
| POST | `/api/create-account` | Create a player account |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Current user |
| GET | `/api/balance` | Current balance |
| GET | `/api/game-access` | Games blocked for the current player |
| POST | `/api/games/wager` | Place a Blackjack or Roulette wager |
| POST | `/api/games/settle` | Settle a pending wager |
| GET | `/api/game-history?page=N` | Settled bets, newest first |
| GET | `/api/players` | List active players |
| POST | `/api/add-funds` | Add chips to a player |
| GET | `/api/get-leaderboard` | Top players by winnings |
| GET | `/api/admin/players` | Admin: all players and totals |
| DELETE | `/api/admin/players/<id>` | Admin: delete a player account |
| PATCH | `/api/admin/players/<id>/games` | Admin: update a player's blocked games |

Pages: `/` (login), `/user`, `/admin`.

## Database

MongoDB at `mongodb://localhost:27017/`, database `Five_Guys_Casino`, collection `users`.

User fields: `name`, `email`, `password_hash`, `role`, `active`, `balance`, `winnings`, `profit`, `blocked_games`, `pending_bets`, `settled_bets`.

## Running

```
pip install -r requirements.txt
python app.py
```

Requires a local MongoDB instance. Set `SECRET_KEY` in the environment for non-demo use.

## Files

- `app.py` - Flask backend and API
- `login.html`, `login.js` - login/sign-up page
- `user.html`, `app.js` - player page and game logic
- `admin.html` - admin dashboard
- `style.css` - shared styles
- `Plan.md` - original project plan
