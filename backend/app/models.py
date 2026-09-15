from datetime import datetime, timezone
from typing import Any, Dict


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MongoModel:
    def __init__(self, data: Dict[str, Any]):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)
        if "id" not in data and "_id" in data and isinstance(data["_id"], int):
            self.id = data["_id"]

    def __getitem__(self, item: str) -> Any:
        return self._data[item]


class User(MongoModel):
    pass


class Event(MongoModel):
    pass


class Registration(MongoModel):
    pass


class LoginAttempt(MongoModel):
    pass

