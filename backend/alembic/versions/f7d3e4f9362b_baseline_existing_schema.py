"""baseline_existing_schema

Revision ID: f7d3e4f9362b
Revises: 55cebbdddc55
Create Date: 2026-04-01 14:03:07.435115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7d3e4f9362b'
down_revision: Union[str, Sequence[str], None] = '55cebbdddc55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
