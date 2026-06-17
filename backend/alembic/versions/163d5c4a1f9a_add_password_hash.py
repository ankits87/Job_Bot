"""add_password_hash

Revision ID: 163d5c4a1f9a
Revises: ca9b87f188a2
Create Date: 2026-06-16 23:51:00.540133

"""
from alembic import op
import sqlalchemy as sa


revision = '163d5c4a1f9a'
down_revision = 'ca9b87f188a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('password_hash', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('password_hash')
