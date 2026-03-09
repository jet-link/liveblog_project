from .dashboard_views import dashboard_view
from .post_views import posts_list, post_edit, post_create, post_delete, post_view_stats
from .comment_views import comments_list, comment_delete, comment_block_user
from .user_views import users_list, user_profile, user_ban, user_unban, user_delete, banned_users_list
from .category_views import categories_list, category_create, category_edit, category_delete
from .tag_views import tags_list, tag_create, tag_edit, tag_delete
from .report_views import reports_list, report_dismiss, report_delete_content, report_ban_user
from .backup_views import backups_list, backup_create, backup_download, backup_restore, backup_delete
from .analytics_views import analytics_view
from .logs_views import logs_view
from .faq_views import faq_list, faq_create, faq_edit, faq_delete

__all__ = [
    'dashboard_view', 'posts_list', 'post_edit', 'post_create', 'post_delete', 'post_view_stats',
    'comments_list', 'comment_delete', 'comment_block_user',
    'users_list', 'user_profile', 'user_ban', 'user_unban', 'user_delete', 'banned_users_list',
    'categories_list', 'category_create', 'category_edit', 'category_delete',
    'tags_list', 'tag_create', 'tag_edit', 'tag_delete',
    'reports_list', 'report_dismiss', 'report_delete_content', 'report_ban_user',
    'backups_list', 'backup_create', 'backup_download', 'backup_restore', 'backup_delete',
    'analytics_view',
    'logs_view',
    'faq_list', 'faq_create', 'faq_edit', 'faq_delete',
]
