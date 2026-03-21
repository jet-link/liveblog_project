"""Load singleton About / Contacts content (DB + fallback)."""
from pages.defaults_static_pages import ABOUT_DEFAULTS, CONTACTS_DEFAULTS
from pages.models import AboutPageContent, ContactsPageContent


def get_about_page() -> AboutPageContent:
    obj, _ = AboutPageContent.objects.get_or_create(pk=1, defaults=ABOUT_DEFAULTS)
    return obj


def get_contacts_page() -> ContactsPageContent:
    obj, _ = ContactsPageContent.objects.get_or_create(pk=1, defaults=CONTACTS_DEFAULTS)
    return obj
