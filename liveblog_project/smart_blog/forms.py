# forms.py (вставь/замени соответствующие части в своём файле)
import re
import html
import bleach
from django import forms
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from .models import Item, Tag, Category, Comment
from .widgets import MultiFileInput
from .utils import normalize_comment_text

# try import CSSSanitizer (bleach >= 6)
try:
    from bleach.css_sanitizer import CSSSanitizer
except Exception:
    CSSSanitizer = None

# optional markdown conversion (pip install markdown)
try:
    import markdown as markdown_lib
except Exception:
    markdown_lib = None



# ---------- sanitize/linkify config ----------
LINKIFY_SKIP_TAGS = ['pre', 'code', 'a']

ALLOWED_TAGS = [
    'a', 'b', 'strong', 'i', 'em', 'u', 'mark',
    'ul', 'ol', 'li', 'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'pre', 'code', 'blockquote', 'img',
    'figure', 'figcaption',
    'table', 'caption', 'thead', 'tbody', 'tr', 'td', 'th'
]

# разрешённые CSS-свойства
ALLOWED_STYLES = [
    'color', 'background-color', 'text-align', 'font-weight',
    'font-style', 'text-decoration', 'margin', 'margin-left', 'margin-right',
    'padding', 'width', 'height', 'white-space', 'overflow', 'max-width'
]

# стартуем с базовых атрибутов bleach и расширяем
FINAL_ALLOWED_ATTRIBUTES = {}
FINAL_ALLOWED_ATTRIBUTES.update(getattr(bleach.sanitizer, 'ALLOWED_ATTRIBUTES', {}))

FINAL_ALLOWED_ATTRIBUTES.update({
    'a': ['href', 'title', 'target', 'rel', 'name'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'style', 'class'],
    'p': ['style', 'class'],
    'span': ['style', 'class'],
    'div': ['style', 'class'],
    'blockquote': ['style', 'class'],
    'table': ['class', 'style'],
    'caption': ['class', 'style'],
    'thead': ['class', 'style'],
    'tbody': ['class', 'style'],
    'tr': ['class', 'style'],
    'td': ['colspan', 'rowspan', 'style', 'class', 'data-language'],
    'th': ['colspan', 'rowspan', 'style', 'class', 'data-language'],
    'pre': ['class', 'style', 'data-language'],
    'code': ['class', 'style', 'data-language'],
    'mark': ['class', 'style'],
    'h1': ['style'], 'h2': ['style'], 'h3': ['style'],
    'h4': ['style'], 'h5': ['style'], 'h6': ['style'],
    'figure': ['class', 'style'],
    'figcaption': ['class', 'style'],
})

# разрешаем любые data-* атрибуты через regex-ключ
FINAL_ALLOWED_ATTRIBUTES.update({
    re.compile(r'^data-'): True
})

# ---------- форма ----------
class ItemCreateForm(forms.ModelForm):
    images = forms.FileField(
        required=False,
        widget=MultiFileInput(),
        help_text="(You can upload 10 images)",
        label='Upload images (optional)',
    )

    tags = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.all().order_by("tag_name"),
        required=False,
        label="Existing tags",
        widget=forms.CheckboxSelectMultiple(attrs={"class": "tag-badge-checkbox"}),
    )

    new_tags = forms.CharField(
        required=False,
        label="Enter tag (optional)",
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Enter tag/s separate with spaces (optional)", "spellcheck": "true"}),
    )

    category = forms.ModelChoiceField(
        queryset=Category.objects.all().order_by("name"),
        required=False,
        label="Category",
        empty_label="— Select category —",
        widget=forms.Select(attrs={"class": "custom-select-category"}),
    )

    class Meta:
        model = Item
        fields = ["title", "text", "category", "tags", "new_tags"]
        labels = {"title": "Enter title", "text": "Item text"}
        widgets = {
            "title": forms.TextInput(attrs={"class": "form-control", "placeholder": "Enter title", "required": True, "spellcheck": "true"}),
            "text": forms.Textarea(attrs={
                "class": "form-control editor-container__editor ckeditor",
                # "id": "editor",
                "placeholder": "Fill the text",
                "rows": 15,
                "spellcheck": "true",
            }),
        }

    def clean_title(self):
        title = self.cleaned_data.get("title", "")
        if len(title) > 40:
            raise forms.ValidationError("Length of title should not exceed 40 symbols.")
        return title

    def clean_new_tags(self):
        value = (self.cleaned_data.get('new_tags') or '').strip()
        if not value:
            return value
        from admin_panel.models import ForbiddenWord
        forbidden = list(ForbiddenWord.objects.filter(is_active=True))
        if not forbidden:
            return value
        tokens = [t.strip() for t in re.split(r'\s+', value) if t.strip()]
        for token in tokens:
            normalized = token.lower()
            for fw in forbidden:
                if fw.is_active and fw.word.lower() in normalized:
                    raise forms.ValidationError('Sorry, forbidden tag.')
        return value

    def clean_text(self):
        """
        1) Optionally convert fenced-code markdown -> HTML (if markdown lib present)
        2) Sanitize HTML via bleach (allow code, pre, table, mark, underline, data-*)
        3) Linkify (skipping pre/code/a)
        """
        raw = self.cleaned_data.get('text', '') or ''

        # normalize multiple line breaks (plain text)
        raw = re.sub(r'(\r?\n\s*){3,}', '\n\n', raw)
        raw = re.sub(r'^(\s*\r?\n)+', '\n', raw)
        raw = re.sub(r'(\r?\n\s*)+$', '\n', raw)

        # normalize empty HTML paragraphs (CKEditor output)
        raw = re.sub(r'(<p(?:\s[^>]*)?>\s*</p>\s*){2,}', '<p></p>', raw)
        raw = re.sub(r'^(<p(?:\s[^>]*)?>\s*</p>\s*)+', '', raw)
        raw = re.sub(r'(<p(?:\s[^>]*)?>\s*</p>\s*)+$', '', raw)
        raw = re.sub(r'(<p(?:\s[^>]*)?>\s*<br\s*/?>\s*</p>\s*){2,}', '<p><br></p>', raw)
        raw = raw.strip()

        # basic validation
        if not raw or not raw.strip():
            raise ValidationError(_('Please write the item text *'))

        # normalize
        raw = raw.replace('\x00', '')
        raw = html.unescape(raw)

        # 1) Markdown fenced-code conversion (best-effort)
        converted = raw
        try:
            # only try convert when there are fenced code markers or markdown headings
            if markdown_lib and (re.search(r'(^```)|(^#{1,6}\s)', raw, flags=re.M) or re.search(r'\n```', raw)):
                exts = ['fenced_code']
                # try to include codehilite if available (not required)
                try:
                    exts.append('codehilite')
                except Exception:
                    pass
                converted = markdown_lib.markdown(raw, extensions=exts)
                # преобразуем class="language-xxx" -> data-language="xxx" для <pre> и <code>
                try:
                    converted = re.sub(
                        r'(<pre[^>]*>)\s*<code[^>]*class="([^"]*language-([a-z0-9_+-]+)[^"]*)"([^>]*)>',
                        lambda m: f'{m.group(1)}<code data-language="{m.group(3)}"{m.group(4)}>',
                        converted,
                        flags=re.I
                    )
                    # также поддержка случая когда markdown уже поместил language в <code class="language-..."> но не в pre
                    converted = re.sub(
                        r'<code[^>]*class="([^"]*language-([a-z0-9_+-]+)[^"]*)"([^>]*)>',
                        lambda m: f'<code data-language="{m.group(2)}"{m.group(3)}>',
                        converted, flags=re.I
                    )
                except Exception:
                    pass
        except Exception:
            converted = raw

        # 2) Sanitize with bleach
        try:
            if CSSSanitizer is not None:
                css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_STYLES)
                cleaner = bleach.Cleaner(
                    tags=ALLOWED_TAGS,
                    attributes=FINAL_ALLOWED_ATTRIBUTES,
                    strip=True,
                    css_sanitizer=css_sanitizer
                )
            else:
                cleaner = bleach.Cleaner(
                    tags=ALLOWED_TAGS,
                    attributes=FINAL_ALLOWED_ATTRIBUTES,
                    strip=True
                )
            cleaned = cleaner.clean(converted)
        except Exception:
            # ultimate fallback
            cleaned = bleach.clean(converted, tags=ALLOWED_TAGS, attributes=FINAL_ALLOWED_ATTRIBUTES, strip=True)

        # 3) linkify but skip pre/code/a so we don't break code blocks or existing anchors
        try:
            cleaned = bleach.linkify(cleaned, skip_tags=LINKIFY_SKIP_TAGS, parse_email=False)
        except Exception:
            pass

        # 4) ensure there is visible text
        plain = re.sub(r'<[^>]+>', '', cleaned).strip()
        if not plain:
            raise ValidationError(_('Please write the item text *'))

        return cleaned


# simple CommentForm (оставил как есть; при необходимости можно расширить)
class CommentForm(forms.ModelForm):
    MAX_TEXT_LEN = 500
    class Meta:
        model = Comment
        fields = ["text"]
        widgets = {
            "text": forms.Textarea(attrs={
                "class": "form-control auto-grow",
                "id": "id_comment_text",
                "placeholder": " ",
                "rows": 1,          # стартовая высота
                "required": True,
                "spellcheck": "true",
            })
        }
        # error_messages = {
        #     "text": {
        #         "required": _("Please write a comment *")
        #     }
        # }

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.fields["text"].error_messages = {"required": _("Please write a comment *")}

    def clean_text(self):
        raw = self.cleaned_data.get("text", "") or ""
        raw = raw.replace('\x00', '')
        normalized = normalize_comment_text(raw)
        text_for_count = re.sub(r'@\[\s*user\s*:\s*\d+\s*\],\s*', '', normalized)
        text_for_count = re.sub(r'[\r\n]', '', text_for_count)
        if len(text_for_count) > self.MAX_TEXT_LEN:
            raise ValidationError(_('Maximum 500 characters (line breaks are not counted).'))

        allowed_tags = ['a', 'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span']
        allowed_attrs = {
            'a': ['href', 'title', 'target', 'rel', 'class'],
            'div': ['class'],
            'span': ['class'],
            'p': ['class'],
        }

        cleaned = bleach.clean(raw, tags=allowed_tags, attributes=allowed_attrs, strip=True)

        def _linkify_cb(attrs, new=False):
            current = attrs.get((None, "class"), "")
            if "primary_" not in current:
                attrs[(None, "class")] = (current + " primary_").strip()
            attrs[(None, "target")] = "_blank"
            attrs[(None, "rel")] = "noopener noreferrer"
            return attrs

        try:
            cleaned = bleach.linkify(cleaned, skip_tags=['a'], parse_email=False, callbacks=[_linkify_cb])
        except Exception:
            pass

        # ensure all links open in new tab
        cleaned = re.sub(
            r'<a(?![^>]*\btarget=)[^>]*>',
            lambda m: m.group(0).replace('<a', '<a target="_blank" rel="noopener noreferrer"', 1),
            cleaned,
            flags=re.I
        )

        # collapse multiple line breaks / empty blocks to максимум двух
        cleaned = re.sub(r'(<br\s*/?>\s*){3,}', '<br><br>', cleaned, flags=re.I)
        cleaned = re.sub(r'(<p>\s*<br\s*/?>\s*</p>\s*){3,}', '<br><br>', cleaned, flags=re.I)
        cleaned = re.sub(r'(<div>\s*<br\s*/?>\s*</div>\s*){3,}', '<br><br>', cleaned, flags=re.I)

        plain = re.sub(r'<[^>]+>', '', cleaned).strip()
        if not plain or len(plain) < 2:
            raise forms.ValidationError("Please enter comment")

        return cleaned