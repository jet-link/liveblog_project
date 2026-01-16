from django.forms.widgets import FileInput

class MultiFileInput(FileInput):
    allow_multiple_selected = True

    def __init__(self, attrs=None):
        attrs = attrs or {}
        attrs.update({"multiple": True})
        super().__init__(attrs)