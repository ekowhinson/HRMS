"""
LLM provider abstraction layer.

Defines the LLMProvider interface and concrete implementations.
Follows Dependency Inversion Principle: views and services depend on the
abstraction, not on Ollama directly.
"""

import abc
import base64
import json
import logging
from typing import Generator

from django.conf import settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an intelligent AI assistant integrated into a comprehensive Human Resource Management System (HRMS) / ERP platform. You help users with any HR, payroll, or ERP-related tasks.

You have knowledge of the following system modules:

**Self-Service Portal**
- Employee profile management, leave requests, payslips, loans, appraisals
- Data update requests, service requests, training enrollment
- Internal job board, disciplinary records, grievances

**HR Management**
- Employee lifecycle: onboarding, transfers, promotions, exits/offboarding
- Organization structure: departments, divisions, units, job grades, positions
- Leave management: leave types, balances, approvals, calendars
- Recruitment: vacancies, applications, interviews, offers
- Discipline & grievance management
- Company policies & SOPs
- Announcements

**Performance Management**
- Appraisal cycles, KPIs, competencies, core values
- Probation assessments, performance appeals
- Training needs analysis

**Training & Development**
- Training programs, sessions, enrollment
- Development plans, skill tracking

**Payroll**
- Payroll processing, pay periods, salary components
- Tax configuration (Ghana PAYE, SSNIT, Tier 2, Tier 3)
- Loans, backpay, salary upgrades
- Transaction types, employee transactions
- Payroll reports: master report, reconciliation, journal entries

**Finance & General Ledger**
- Chart of accounts, journal entries, budgets
- Vendors, customers, invoices, payments
- Bank reconciliation, financial reports

**Procurement**
- Purchase requisitions, purchase orders
- Goods receipt, vendor contracts

**Inventory & Assets**
- Items, stock levels, warehouses
- Asset register, depreciation schedules

**Projects & Timesheets**
- Project management, task tracking
- Timesheets, resource allocation

**Administration**
- User management, role-based access control
- Approval workflows, audit logs
- Data import/export, backup & restore

Guidelines:
- Be helpful, concise, and professional
- When explaining processes, reference the specific module or menu path
- If asked about data you don't have access to, explain what information the user should look for and where
- Format responses with markdown for readability (headers, lists, bold, code blocks)
- If a question is ambiguous, ask for clarification
- You can help with policy questions, process explanations, troubleshooting, and general HR/payroll guidance
"""

PAYROLL_AUDIT_SYSTEM_PROMPT = """You are also a payroll audit specialist for a Ghana-based organization. You have been provided with actual payroll run data and automated audit results.

When analyzing payroll data:
- Explain audit findings in plain, actionable language
- Identify patterns and anomalies beyond what the automated checks found
- Reference specific employee numbers, amounts, and component codes
- Use Ghana payroll terminology: PAYE (Pay As You Earn), SSNIT (Social Security), Tier 2 (Occupational Pension), GHS (Ghana Cedis)
- Clearly distinguish between critical errors (math mismatches, wrong statutory rates) and informational items (outliers, proration)
- Provide a structured summary: what looks correct, what needs review, and recommended actions
- If all automated checks passed, still look at the employee details and component breakdown for anything unusual
"""


class LLMProvider(abc.ABC):
    """Abstract base class for LLM providers."""

    @abc.abstractmethod
    def chat_stream(
        self,
        history: list[dict],
        user_message: str,
        context: str | None = None,
        extra_system_prompt: str | None = None,
    ) -> Generator[str, None, None]:
        """Stream chat responses as JSON-line strings."""

    @abc.abstractmethod
    def chat_stream_with_files(
        self,
        history: list[dict],
        user_message: str,
        attachments: list,
    ) -> Generator[str, None, None]:
        """Stream chat responses with file/image context."""

    @abc.abstractmethod
    def chat_json(
        self,
        system_prompt: str,
        user_message: str,
    ) -> str:
        """Non-streaming single-shot chat that returns the full response text.
        Used for structured tasks like column mapping where streaming is not needed.
        """

    @abc.abstractmethod
    def check_health(self) -> dict:
        """Check provider health and model availability."""


class OllamaProvider(LLMProvider):
    """Ollama-backed LLM provider."""

    def __init__(self):
        self.base_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model = getattr(settings, 'OLLAMA_MODEL', 'llama3.1')

    def _get_client(self):
        import ollama
        return ollama.Client(host=self.base_url)

    def chat_stream(self, history, user_message, context=None, extra_system_prompt=None):
        system = SYSTEM_PROMPT
        if extra_system_prompt:
            system += "\n\n" + extra_system_prompt

        enhanced_message = user_message
        if context:
            enhanced_message = f"{user_message}\n\n{context}"

        messages = [{"role": "system", "content": system}]
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": enhanced_message})

        try:
            client = self._get_client()
            stream = client.chat(
                model=self.model,
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield json.dumps({"type": "token", "content": token}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as e:
            logger.error(f"Ollama streaming error: {e}")
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    def chat_stream_with_files(self, history, user_message, attachments):
        image_attachments = [a for a in attachments if a.file_type == 'IMAGE']
        context_attachments = [a for a in attachments if a.file_type != 'IMAGE']

        file_context = None
        if context_attachments:
            file_context = "[Attached File Data]\n" + "\n\n".join([
                f"--- File: {a.file_name} ---\n{a.parsed_summary}"
                for a in context_attachments
            ])

        if not image_attachments:
            yield from self.chat_stream(history, user_message, context=file_context)
            return

        model = getattr(settings, 'OLLAMA_VISION_MODEL', 'llava')
        images = [base64.b64encode(bytes(a.file_data)).decode() for a in image_attachments]

        enhanced_message = user_message
        if file_context:
            enhanced_message = f"{user_message}\n\n{file_context}"

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": enhanced_message})

        try:
            client = self._get_client()
            kwargs = {
                'model': model,
                'messages': messages,
                'stream': True,
            }
            kwargs['messages'][-1]['images'] = images

            stream = client.chat(**kwargs)
            for chunk in stream:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield json.dumps({"type": "token", "content": token}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as e:
            logger.error(f"Ollama streaming error (model={model}): {e}")
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    def chat_json(self, system_prompt, user_message):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        try:
            client = self._get_client()
            response = client.chat(
                model=self.model,
                messages=messages,
                stream=False,
            )
            return response.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Ollama chat_json error: {e}")
            raise

    def check_health(self):
        try:
            client = self._get_client()
            models = client.list()
            model_names = [m.model for m in models.models] if hasattr(models, 'models') else []
            model_available = any(
                self.model in name or name.startswith(self.model)
                for name in model_names
            )
            return {
                "status": "ok",
                "model": self.model,
                "model_available": model_available,
                "available_models": model_names,
            }
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return {
                "status": "error",
                "model": self.model,
                "model_available": False,
                "error": str(e),
            }


def get_llm_provider() -> LLMProvider:
    """Factory function returning the configured LLM provider."""
    return OllamaProvider()
