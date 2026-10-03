import json

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

import config


def connect() -> psycopg.Connection:
    """Direct connection to Neon for the worker (autocommit, rows as dicts)."""
    return psycopg.connect(config.database_url(), autocommit=True,
                           prepare_threshold=0, row_factory=dict_row)


def jsonb(obj) -> Jsonb:
    return Jsonb(obj, dumps=lambda o: json.dumps(o, default=str))
