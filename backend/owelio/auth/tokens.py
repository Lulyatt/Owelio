import secrets
from dataclasses import dataclass, field


@dataclass
class TokenStore:
    _token_to_user: dict[str, str] = field(default_factory=dict)

    def issue(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        self._token_to_user[token] = user_id
        return token

    def user_id_for(self, token: str | None) -> str | None:
        if not token:
            return None
        return self._token_to_user.get(token)

    def revoke(self, token: str | None) -> None:
        if token:
            self._token_to_user.pop(token, None)


def create_token_store() -> TokenStore:
    return TokenStore()
