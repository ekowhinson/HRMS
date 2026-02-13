from django.urls import path
from . import views

app_name = 'assistant'

urlpatterns = [
    path('chat/', views.ChatView.as_view(), name='chat'),
    path('upload/', views.FileUploadView.as_view(), name='upload'),
    path('templates/', views.PromptTemplateListView.as_view(), name='templates'),
    path('conversations/', views.ConversationListView.as_view(), name='conversation-list'),
    path('conversations/<uuid:pk>/', views.ConversationDetailView.as_view(), name='conversation-detail'),
    path('health/', views.AssistantHealthView.as_view(), name='health'),
]
