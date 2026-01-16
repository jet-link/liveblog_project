from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from urllib.parse import urlparse
import os
# from django.core.files.images import get_image_dimensions


def is_valid_image_url(url: str) -> bool:
    if not url:
        return False

    try:
        parsed = urlparse(url)
    except Exception:
        return False

    # должен быть http / https
    if parsed.scheme not in ("http", "https"):
        return False

    # проверяем расширение
    ext = os.path.splitext(parsed.path)[1].lower()

    allowed_ext = {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"
    }

    return ext in allowed_ext



# Register
class CustomUserCreationForm(UserCreationForm):
    username = forms.CharField(
        max_length=150,
        required=True,
        label=_('Username'),
        widget=forms.TextInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingUsername',
            'placeholder': 'Username',
            'autocomplete': 'username',
            "required": True
        }),
        error_messages={
            'required': _('Enter username'),
            'max_length': _('Too long username length'),
        }
    )

    first_name = forms.CharField(
        max_length=30,
        required=False,
        label=_('First name'),
        widget=forms.TextInput(attrs={
            'class': 'form-control text-muted', 
            'id': 'floatingFirst',
            'placeholder': 'First name...',
            'autocomplete': 'given-name',
            }),
    )
    last_name = forms.CharField(
        max_length=150,
        required=False,
        label=_('Surname'),
        widget=forms.TextInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingLast',
            'placeholder': 'Second name...',
            'autocomplete': 'family-name',
            }),
    )
    email = forms.EmailField(
        required=False,
        label=_('E-mail'),
        widget=forms.EmailInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingEmail', 
            'placeholder': 'you@example.com...',
            'autocomplete': 'email',
            }),
        error_messages={'invalid': _('Enter correct e-mail (example_profile@mail.com)')},
    )

    # password1 и password2 — объявляем явно, чтобы задать виджеты и сообщения
    password1 = forms.CharField(
        label=_('Password'),
        widget=forms.PasswordInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingPass1',
            'placeholder': 'Password',
            'autocomplete': 'new-password',
            "required": True
        }),
        error_messages={'required': _('Enter password')},
    )
    password2 = forms.CharField(
        label=_('Password again'),
        widget=forms.PasswordInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingPass2',
            'placeholder': 'Password again',
            'autocomplete': 'new-password',
            "required": True
        }),
        error_messages={'required': _('Confirm the password')},
    )

    avatar_url = forms.URLField(
        required=False,
        label=('Avatar (image URL)'),
        widget=forms.URLInput(attrs={
            'class': 'form-control text-muted',
            'placeholder': 'Avatar URL https:// (optional)',
            'id': 'floatingAvatar'
        }),
        help_text=_('Optional. If empty, default avatar will be used.')
    )
    # 🆕 загрузка файла
    avatar_file = forms.ImageField(
        required=False,
        label=_('Avatar (upload file)'),
        widget=forms.ClearableFileInput(attrs={
            'class': 'form-control',
            'accept': 'image/*',
        }),
        help_text=_('Upload avatar from your device.')
    )


    error_messages = {
        'password_mismatch': _("Passwords not same"),
        'username_taken': _("User with this name already exist"),
    }

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email", "password1", "password2")

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if username and User.objects.filter(username=username).exists():
            raise forms.ValidationError(self.error_messages['username_taken'], code='username_taken')
        return username

    def clean(self):
        cleaned_data = super().clean()
        pw1 = cleaned_data.get("password1")
        pw2 = cleaned_data.get("password2")
        if pw1 and pw2 and pw1 != pw2:
            self.add_error('password2', forms.ValidationError(self.error_messages['password_mismatch'], code='password_mismatch'))
        return cleaned_data


# Login
class LoginForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        required=True,
        label=_('Username *'),
        widget=forms.TextInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingInput',
            'placeholder': 'Username',
            'autocomplete': 'username',
            "required": True
        }),
        error_messages={'required': _('Please enter username')},
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingPassword',
            'placeholder': 'Password',
            'autocomplete': 'current-password',
            "required": True
        }),
        required=True,
        label=_('Password *'),
        error_messages={'required': _('Please enter password')},
    )
    remember = forms.BooleanField(
        required=False,
        initial=False,
        label=_('Remember me'),
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'checkDefault'}),
    )



# Edit profile
class UserEditForm(forms.ModelForm):
    avatar_url = forms.URLField(
        required=False,
        label=_('Avatar (image URL)'),
        widget=forms.URLInput(attrs={
            'class': 'form-control text-muted',
            'id': 'floatingAvatarProfile',
            'placeholder': 'https://... (optional)',
        }),
        help_text=_('Optional: link to your avatar image.')
    )

    avatar_file = forms.ImageField(
    required=False,
    label=_('Upload avatar (optional)'),
    widget=forms.ClearableFileInput(attrs={
        'class': 'form-control',
        'accept': 'image/*',
    }),
    )

    class Meta:
        model = User
        # avatar_url добавлен в список полей
        fields = ['username', 'first_name', 'last_name', 'email', 'avatar_url', 'avatar_file',]

        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'form-control text-muted',
                'id': 'floatingUsernameProfile',
                'autocomplete': 'username',
                'placeholder': 'Username',
                "required": True
            }),
            'first_name': forms.TextInput(attrs={
                'class': 'form-control text-muted',
                'id': 'floatingFirstNameProfile',
                'autocomplete': 'given-name',
                'placeholder': 'First name'
            }),
            'last_name': forms.TextInput(attrs={
                'class': 'form-control text-muted',
                'id': 'floatingLastNameProfile',
                'autocomplete': 'family-name',
                'placeholder': 'Last name'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control text-muted',
                'id': 'floatingEmailProfile',
                'autocomplete': 'email',
                'placeholder': 'you@example.com'
            }),
            # avatar_url виджет объявлен отдельно над классом Meta, поэтому не требуется здесь
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # instance may be None in some contexts — guard
        user = getattr(self, 'instance', None)

        # If instance present, set initial values rather than manipulating attrs.value
        if user:
            # initial values
            self.initial.setdefault('username', user.username or '')
            self.initial.setdefault('first_name', user.first_name or '')
            self.initial.setdefault('last_name', user.last_name or '')
            self.initial.setdefault('email', user.email or '')

            # initial avatar from profile if exists
            try:
                self.initial.setdefault('avatar_url', user.profile.avatar_url or '')
            except Exception:
                self.initial.setdefault('avatar_url', '')

    def clean_username(self):
        username = self.cleaned_data.get('username', '').strip()
        if not username:
            return username

        qs = User.objects.filter(username__iexact=username)
        if self.instance and getattr(self.instance, 'pk', None):
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise ValidationError(_("User with this username already exists."), code='username_taken')

        return username

    def clean(self):
        cleaned = super().clean()
        # ----------------------------
        # username uniqueness check
        # ----------------------------
        username = cleaned.get('username')
        if username:
            qs = User.objects.filter(username__iexact=username)
            if self.instance and getattr(self.instance, 'pk', None):
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                self.add_error(
                    'username',
                    ValidationError(_("User with this username already exists."))
                )

        
        # ----------------------------
        # avatar priority validation
        # ----------------------------
        url = cleaned.get('avatar_url')
        file = cleaned.get('avatar_file')

        if url and file:
            raise ValidationError(
                _("Please choose either avatar URL or upload a file, not both.")
            )
        
        if url and not is_valid_image_url(url):
            self.add_error('avatar_url',
                _("Enter a valid image URL.")
            )

        return cleaned

    def save(self, commit=True):
        user = super().save(commit=commit)

        avatar_url = self.cleaned_data.get('avatar_url')
        avatar_file = self.cleaned_data.get('avatar_file')

        from .models import Profile
        profile, _ = Profile.objects.get_or_create(user=user)

        # ✅ 1. Загружен НОВЫЙ файл
        if avatar_file:
            profile.avatar_file = avatar_file
            profile.avatar_url = None
            profile.save()
            return user

        # ✅ 2. Введён НОВЫЙ URL
        if avatar_url:
            profile.avatar_url = avatar_url
            profile.avatar_file = None
            profile.save()
            return user

        # ✅ 3. НИЧЕГО НЕ МЕНЯЛИ → НЕ ТРОГАЕМ АВАТАР
        # (оставляем avatar_file / avatar_url как есть)
        return user
    
    def clean_avatar_file(self):
        avatar = self.cleaned_data.get('avatar_file')
        if not avatar:
            return avatar

        if not avatar.content_type.startswith('image/'):
            raise ValidationError("Only image files are allowed.")

        if avatar.size > 5 * 1024 * 1024:  # 5 MB
            raise ValidationError("Image file is too large (max 5MB).")

        return avatar

class PasswordChangeSimpleForm(forms.Form):
    new_password1 = forms.CharField(
        label='New password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter password',
            "required": True,
            "id": "id_new_password1"
            })
    )
    new_password2 = forms.CharField(
        label='Confirm password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter password again',
            "required": True,
            "id": "id_new_password2"
            })
    )

    def clean(self):
        cleaned_data = super().clean()
        p1 = cleaned_data.get('new_password1')
        p2 = cleaned_data.get('new_password2')

        if p1 and p2 and p1 != p2:
            self.add_error('new_password2', 'Passwords do not match.')
        return cleaned_data