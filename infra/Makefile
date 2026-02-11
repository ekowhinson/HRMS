# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Terraform Makefile
# Usage: make <target> ENV=<staging|production>
# ─────────────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Validate ENV is set for targets that need it
define check_env
	@if [ -z "$(ENV)" ]; then \
		echo "ERROR: ENV is required. Usage: make $(MAKECMDGOALS) ENV=staging|production"; \
		exit 1; \
	fi
	@if [ "$(ENV)" != "staging" ] && [ "$(ENV)" != "production" ]; then \
		echo "ERROR: ENV must be 'staging' or 'production'. Got: $(ENV)"; \
		exit 1; \
	fi
	@if [ ! -f "environments/$(ENV)/backend.hcl" ]; then \
		echo "ERROR: environments/$(ENV)/backend.hcl not found"; \
		exit 1; \
	fi
endef

# ── Environment-aware targets ────────────────────────────────────────────────

.PHONY: init
init: ## Initialize Terraform for an environment (ENV=staging|production)
	$(check_env)
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Initializing Terraform for: $(ENV)"
	@echo "══════════════════════════════════════════════════════════════"
	terraform init \
		-reconfigure \
		-backend-config=environments/$(ENV)/backend.hcl

.PHONY: plan
plan: ## Generate execution plan (ENV=staging|production)
	$(check_env)
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Planning Terraform for: $(ENV)"
	@echo "══════════════════════════════════════════════════════════════"
	terraform plan \
		-var-file=environments/$(ENV)/terraform.tfvars \
		-out=.tfplan-$(ENV)

.PHONY: apply
apply: ## Apply changes (ENV=staging|production)
	$(check_env)
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Applying Terraform for: $(ENV)"
	@echo "══════════════════════════════════════════════════════════════"
	@if [ -f ".tfplan-$(ENV)" ]; then \
		terraform apply .tfplan-$(ENV); \
	else \
		echo "No saved plan found. Running plan + apply..."; \
		terraform apply \
			-var-file=environments/$(ENV)/terraform.tfvars; \
	fi

.PHONY: destroy
destroy: ## Destroy infrastructure (ENV=staging|production) – requires confirmation
	$(check_env)
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║  WARNING: This will DESTROY all $(ENV) infrastructure!      ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@read -p "Type '$(ENV)' to confirm destruction: " confirm && \
		if [ "$$confirm" != "$(ENV)" ]; then \
			echo "Aborted. You must type '$(ENV)' exactly."; \
			exit 1; \
		fi
	terraform destroy \
		-var-file=environments/$(ENV)/terraform.tfvars

.PHONY: output
output: ## Show Terraform outputs (ENV=staging|production)
	$(check_env)
	terraform output

.PHONY: import
import: ## Import existing resource (ENV=staging|production ADDR=... RESOURCE=...)
	$(check_env)
	@if [ -z "$(ADDR)" ] || [ -z "$(RESOURCE)" ]; then \
		echo "ERROR: ADDR and RESOURCE are required."; \
		echo "Usage: make import ENV=production ADDR=module.database.google_sql_database_instance.primary RESOURCE=projects/my-project/instances/my-db"; \
		exit 1; \
	fi
	terraform import \
		-var-file=environments/$(ENV)/terraform.tfvars \
		$(ADDR) $(RESOURCE)

.PHONY: state-list
state-list: ## List resources in state (ENV=staging|production)
	$(check_env)
	terraform state list

# ── Environment-independent targets ──────────────────────────────────────────

.PHONY: fmt
fmt: ## Format all Terraform files
	terraform fmt -recursive .

.PHONY: validate
validate: ## Validate Terraform configuration
	terraform validate

.PHONY: clean
clean: ## Remove local plan files and cached plugins
	rm -f .tfplan-staging .tfplan-production
	rm -rf .terraform/

.PHONY: lint
lint: fmt validate ## Format and validate

# ── Convenience targets ──────────────────────────────────────────────────────

.PHONY: staging-plan
staging-plan: ## Shortcut: init + plan for staging
	$(MAKE) init ENV=staging
	$(MAKE) plan ENV=staging

.PHONY: staging-apply
staging-apply: ## Shortcut: init + apply for staging
	$(MAKE) init ENV=staging
	$(MAKE) apply ENV=staging

.PHONY: production-plan
production-plan: ## Shortcut: init + plan for production
	$(MAKE) init ENV=production
	$(MAKE) plan ENV=production

.PHONY: production-apply
production-apply: ## Shortcut: init + apply for production
	$(MAKE) init ENV=production
	$(MAKE) apply ENV=production

# ── Help ─────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@echo "NHIA HRMS – Terraform Infrastructure"
	@echo ""
	@echo "Usage: make <target> [ENV=staging|production]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make init ENV=staging"
	@echo "  make plan ENV=staging"
	@echo "  make apply ENV=staging"
	@echo "  make destroy ENV=staging"
	@echo "  make output ENV=production"
	@echo "  make import ENV=production ADDR=module.db.google_sql_database_instance.primary RESOURCE=projects/proj/instances/inst"
	@echo "  make state-list ENV=production"
	@echo "  make fmt"
	@echo "  make validate"
