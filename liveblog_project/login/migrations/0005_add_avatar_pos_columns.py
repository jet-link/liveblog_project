# Fix: 0004 used SeparateDatabaseAndState with empty database_operations,
# so avatar_pos_x/avatar_pos_y were never created in the database.
# This migration adds the columns via raw SQL.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("login", "0004_profile_avatar_pos_state"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "ALTER TABLE login_profile ADD COLUMN IF NOT EXISTS avatar_pos_x DOUBLE PRECISION NOT NULL DEFAULT 0.0;",
                "ALTER TABLE login_profile ADD COLUMN IF NOT EXISTS avatar_pos_y DOUBLE PRECISION NOT NULL DEFAULT 0.0;",
            ],
            reverse_sql=[
                "ALTER TABLE login_profile DROP COLUMN IF EXISTS avatar_pos_x;",
                "ALTER TABLE login_profile DROP COLUMN IF EXISTS avatar_pos_y;",
            ],
        ),
    ]
