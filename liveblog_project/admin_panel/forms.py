"""Admin panel forms."""
from django import forms
from smart_blog.models import Item, Category, Tag
from smart_blog.forms import ItemCreateForm as BaseItemCreateForm


class ItemAdminCreateForm(BaseItemCreateForm):
    """Admin-styled create form matching edit layout."""

    class Meta(BaseItemCreateForm.Meta):
        widgets = {
            'title': forms.TextInput(attrs={'class': 'admin-input', 'placeholder': 'Enter title'}),
            'text': forms.Textarea(attrs={'class': 'admin-textarea ckeditor', 'rows': 12, 'placeholder': 'Fill the text'}),
            'category': forms.Select(attrs={'class': 'admin-select'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.label_suffix = ''
        self.fields['title'].label = 'Post title'
        self.fields['text'].label = 'Post body'
        self.fields['tags'].widget = forms.SelectMultiple(attrs={'class': 'admin-select', 'size': 6})
        self.fields['new_tags'].widget = forms.TextInput(attrs={'class': 'admin-input', 'placeholder': 'Enter tag/s separate with spaces (optional)'})
        self.fields['images'].widget.attrs.update({'class': 'admin-file-input'})


class ItemAdminEditForm(forms.ModelForm):
    """Simplified form for admin post editing."""

    class Meta:
        model = Item
        fields = ['title', 'text', 'category', 'tags', 'is_published', 'slug']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'admin-input', 'placeholder': 'Title'}),
            'text': forms.Textarea(attrs={'class': 'admin-textarea ckeditor', 'rows': 12, 'placeholder': 'Post text'}),
            'category': forms.Select(attrs={'class': 'admin-select'}),
            'tags': forms.SelectMultiple(attrs={'class': 'admin-select', 'size': 6}),
            'is_published': forms.CheckboxInput(attrs={'class': 'admin-checkbox'}),
            'slug': forms.TextInput(attrs={'class': 'admin-input', 'placeholder': 'slug'}),
        }
        labels = {
            'title': 'Post title',
            'text': 'Post body',
            'category': 'Category',
            'tags': 'Tags',
            'is_published': 'Is published',
            'slug': 'Slug',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.label_suffix = ''
