from django.urls import path
from . import views

app_name = 'assistant'

urlpatterns = [
    # Chat & conversation
    path('chat/', views.ChatView.as_view(), name='chat'),
    path('upload/', views.FileUploadView.as_view(), name='upload'),
    path('templates/', views.PromptTemplateListView.as_view(), name='templates'),
    path('conversations/', views.ConversationListView.as_view(), name='conversation-list'),
    path('conversations/<uuid:pk>/', views.ConversationDetailView.as_view(), name='conversation-detail'),
    path('health/', views.AssistantHealthView.as_view(), name='health'),

    # Import pipeline
    path('import/analyze/', views.ImportAnalyzeView.as_view(), name='import-analyze'),
    path('import/preview/', views.ImportPreviewView.as_view(), name='import-preview'),
    path('import/confirm/', views.ImportConfirmView.as_view(), name='import-confirm'),
    path('import/<uuid:pk>/progress/', views.ImportProgressView.as_view(), name='import-progress'),
    path('import/<uuid:pk>/', views.ImportSessionDetailView.as_view(), name='import-detail'),
    path('import/entity-types/', views.ImportEntityTypesView.as_view(), name='import-entity-types'),
]
