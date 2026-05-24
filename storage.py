from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,16}$")


class UserStorage:
    def __init__(self, path: str | Path = "data/users.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._save({"users": {}})

    def _load(self) -> dict:
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data.get("users"), dict):
                raise ValueError("Invalid data shape")
            return data
        except (OSError, json.JSONDecodeError, ValueError):
            data = {"users": {}}
            self._save(data)
            return data

    def _save(self, data: dict) -> None:
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)

    @staticmethod
    def _hash_password(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def _key(username: str) -> str:
        return username.strip().lower()

    def register_user(self, username: str, password: str) -> tuple[bool, str, str | None]:
        username = username.strip()
        if not USERNAME_PATTERN.fullmatch(username):
            return False, "Username must be 3-16 chars: letters, numbers, or _.", None
        if len(password) < 4:
            return False, "Password must be at least 4 characters.", None

        key = self._key(username)
        data = self._load()

        if key in data["users"]:
            return False, "That username already exists.", None

        data["users"][key] = {
            "display_name": username,
            "password_hash": self._hash_password(password),
            "best_score": 0,
            "last_score": 0,
        }
        self._save(data)
        return True, "Account created. You can play now.", key

    def authenticate_user(self, username: str, password: str) -> tuple[bool, str, str | None]:
        key = self._key(username)
        data = self._load()
        user = data["users"].get(key)

        if not user:
            return False, "User not found. Register first or try again.", None
        if user["password_hash"] != self._hash_password(password):
            return False, "Incorrect password.", None

        return True, "Login successful.", key

    def get_profile(self, user_key: str) -> dict | None:
        return self._load()["users"].get(user_key)

    def update_score(self, user_key: str, score: int) -> dict | None:
        data = self._load()
        user = data["users"].get(user_key)
        if not user:
            return None

        user["last_score"] = max(0, int(score))
        user["best_score"] = max(int(user.get("best_score", 0)), user["last_score"])
        self._save(data)
        return user

    def get_leaderboard(self, limit: int = 5) -> list[dict]:
        users = list(self._load()["users"].values())
        users.sort(key=lambda entry: (-int(entry.get("best_score", 0)), entry.get("display_name", "")))
        return users[:limit]
