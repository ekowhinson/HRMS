#!/usr/bin/env python3
"""
GCP Deployment & CI/CD Pipeline Guide - PDF Generator
HRMS / Payroll / ERP Multi-Tenant System
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from reportlab.lib.colors import HexColor
from datetime import datetime
import os

# ── Colors ──
PRIMARY = HexColor("#1a365d")
SECONDARY = HexColor("#2b6cb0")
ACCENT = HexColor("#3182ce")
LIGHT_BG = HexColor("#ebf4ff")
LIGHT_GRAY = HexColor("#f7fafc")
DARK_TEXT = HexColor("#1a202c")
MEDIUM_TEXT = HexColor("#4a5568")
BORDER = HexColor("#cbd5e0")
TABLE_HEADER_BG = HexColor("#2d3748")
TABLE_ALT_ROW = HexColor("#f0f4f8")
SUCCESS = HexColor("#276749")
WARNING = HexColor("#c05621")
DANGER = HexColor("#c53030")
CODE_BG = HexColor("#1e293b")
CODE_TEXT = HexColor("#e2e8f0")
TIP_BG = HexColor("#f0fff4")
TIP_BORDER = HexColor("#38a169")
WARN_BG = HexColor("#fffbeb")
WARN_BORDER = HexColor("#d69e2e")
CRIT_BG = HexColor("#fff5f5")
CRIT_BORDER = HexColor("#e53e3e")

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "HRMS_Payroll_ERP_GCP_Deployment_CICD_Guide.pdf",
)


def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CoverTitle', fontName='Helvetica-Bold', fontSize=32,
        leading=40, textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name='CoverSubtitle', fontName='Helvetica', fontSize=16,
        leading=22, textColor=SECONDARY, alignment=TA_CENTER, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='CoverMeta', fontName='Helvetica', fontSize=11,
        leading=16, textColor=MEDIUM_TEXT, alignment=TA_CENTER, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle', fontName='Helvetica-Bold', fontSize=20,
        leading=26, textColor=PRIMARY, spaceBefore=24, spaceAfter=12,
        borderWidth=2, borderColor=ACCENT, borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        name='SubSection', fontName='Helvetica-Bold', fontSize=14,
        leading=20, textColor=SECONDARY, spaceBefore=16, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name='SubSubSection', fontName='Helvetica-Bold', fontSize=12,
        leading=16, textColor=ACCENT, spaceBefore=10, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='Body', fontName='Helvetica', fontSize=10,
        leading=14, textColor=DARK_TEXT, alignment=TA_JUSTIFY, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='BulletItem', fontName='Helvetica', fontSize=10,
        leading=14, textColor=DARK_TEXT, leftIndent=20, spaceAfter=3,
        bulletIndent=8,
    ))
    styles.add(ParagraphStyle(
        name='SubBulletItem', fontName='Helvetica', fontSize=9,
        leading=13, textColor=MEDIUM_TEXT, leftIndent=40, spaceAfter=2,
        bulletIndent=28,
    ))
    styles.add(ParagraphStyle(
        name='CodeLine', fontName='Courier', fontSize=8,
        leading=11, textColor=DARK_TEXT, leftIndent=12, spaceAfter=2,
        backColor=LIGHT_GRAY,
    ))
    styles.add(ParagraphStyle(
        name='TableHeader', fontName='Helvetica-Bold', fontSize=9,
        leading=12, textColor=colors.white, alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name='TableCell', fontName='Helvetica', fontSize=9,
        leading=12, textColor=DARK_TEXT,
    ))
    styles.add(ParagraphStyle(
        name='TableCellCode', fontName='Courier', fontSize=8,
        leading=11, textColor=ACCENT,
    ))
    styles.add(ParagraphStyle(
        name='FooterText', fontName='Helvetica', fontSize=8,
        leading=10, textColor=MEDIUM_TEXT, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='TipText', fontName='Helvetica', fontSize=9,
        leading=13, textColor=SUCCESS, leftIndent=10, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='WarnText', fontName='Helvetica', fontSize=9,
        leading=13, textColor=WARNING, leftIndent=10, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='CritText', fontName='Helvetica-Bold', fontSize=9,
        leading=13, textColor=DANGER, leftIndent=10, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='NumberedStep', fontName='Helvetica-Bold', fontSize=11,
        leading=15, textColor=PRIMARY, spaceBefore=12, spaceAfter=4,
    ))
    return styles


def make_table(headers, rows, col_widths=None):
    s = get_styles()
    data = [[Paragraph(h, s['TableHeader']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), s['TableCell']) for c in row])
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ALT_ROW))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


def bullet(text):
    s = get_styles()
    return Paragraph(f"\u2022 {text}", s['BulletItem'])


def sub_bullet(text):
    s = get_styles()
    return Paragraph(f"\u2013 {text}", s['SubBulletItem'])


def code_block(lines):
    """Return a list of flowables for a code block."""
    s = get_styles()
    result = [Spacer(1, 4)]
    for line in lines:
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        result.append(Paragraph(escaped, s['CodeLine']))
    result.append(Spacer(1, 4))
    return result


def tip_box(text):
    s = get_styles()
    data = [[Paragraph(f"TIP: {text}", s['TipText'])]]
    tbl = Table(data, colWidths=[None])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TIP_BG),
        ('BOX', (0, 0), (-1, -1), 1, TIP_BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def warn_box(text):
    s = get_styles()
    data = [[Paragraph(f"WARNING: {text}", s['WarnText'])]]
    tbl = Table(data, colWidths=[None])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), WARN_BG),
        ('BOX', (0, 0), (-1, -1), 1, WARN_BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def critical_box(text):
    s = get_styles()
    data = [[Paragraph(f"CRITICAL: {text}", s['CritText'])]]
    tbl = Table(data, colWidths=[None])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CRIT_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, CRIT_BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def hr():
    return HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=8, spaceBefore=8)


def header_footer(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MEDIUM_TEXT)
    canvas.drawString(20 * mm, A4[1] - 15 * mm, "HRMS / Payroll / ERP - GCP Deployment & CI/CD Guide")
    canvas.drawRightString(A4[0] - 20 * mm, A4[1] - 15 * mm, "CONFIDENTIAL")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, A4[1] - 17 * mm, A4[0] - 20 * mm, A4[1] - 17 * mm)
    # Footer
    canvas.line(20 * mm, 20 * mm, A4[0] - 20 * mm, 20 * mm)
    canvas.drawString(20 * mm, 15 * mm, f"Generated: {datetime.now().strftime('%B %d, %Y')}")
    canvas.drawRightString(A4[0] - 20 * mm, 15 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    s = get_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="HRMS / Payroll / ERP - GCP Deployment & CI/CD Pipeline Guide",
        author="DevOps &amp; Infrastructure Team",
    )

    story = []
    W = doc.width

    # ════════════════════════════════════════════════════════════
    #  COVER PAGE
    # ════════════════════════════════════════════════════════════
    story.append(Spacer(1, 80))
    story.append(Paragraph("HRMS / Payroll / ERP", s['CoverTitle']))
    story.append(Paragraph("GCP Deployment &amp; CI/CD", s['CoverTitle']))
    story.append(Paragraph("Pipeline Guide", s['CoverTitle']))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="60%", thickness=3, color=ACCENT, spaceAfter=20, spaceBefore=10))
    story.append(Paragraph("Google Cloud Platform Deployment Guide", s['CoverSubtitle']))
    story.append(Paragraph("Multi-Client Multi-Tenant Architecture", s['CoverSubtitle']))
    story.append(Paragraph("with GitHub Actions CI/CD Pipelines", s['CoverSubtitle']))
    story.append(Spacer(1, 40))
    story.append(Paragraph(f"Version 1.0 | {datetime.now().strftime('%B %d, %Y')}", s['CoverMeta']))
    story.append(Paragraph("Classification: Confidential", s['CoverMeta']))
    story.append(Spacer(1, 20))

    doc_info = [
        ["Document ID", "HRMS-ERP-DEPLOY-2026-001"],
        ["Version", "1.0"],
        ["Status", "Final"],
        ["Date", datetime.now().strftime("%Y-%m-%d")],
        ["Prepared By", "DevOps &amp; Infrastructure Team"],
        ["Target Platform", "Google Cloud Platform (GCP)"],
        ["CI/CD Platform", "GitHub Actions"],
        ["Architecture", "Multi-Client / Multi-Tenant"],
    ]
    info_data = [[Paragraph(r[0], s['TableHeader']), Paragraph(r[1], s['TableCell'])] for r in doc_info]
    info_tbl = Table(info_data, colWidths=[W * 0.35, W * 0.45])
    info_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(info_tbl)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  TABLE OF CONTENTS
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("Table of Contents", s['SectionTitle']))
    story.append(Spacer(1, 10))

    toc_items = [
        ("1", "Architecture Overview"),
        ("2", "Prerequisites Checklist"),
        ("3", "Step-by-Step First Deployment"),
        ("3.1", "Bootstrap GCP Project"),
        ("3.2", "Configure GitHub Secrets"),
        ("3.3", "Deploy Infrastructure with Terraform"),
        ("3.4", "Build &amp; Push Docker Images"),
        ("3.5", "Configure Secrets in Secret Manager"),
        ("3.6", "Run Initial Migrations"),
        ("3.7", "Create Superuser &amp; Load Seed Data"),
        ("3.8", "Build &amp; Upload Frontend"),
        ("3.9", "Configure DNS &amp; Verify SSL"),
        ("3.10", "Smoke Tests"),
        ("4", "CI/CD Pipeline Reference"),
        ("4.1", "CI Pipeline"),
        ("4.2", "Deploy Staging"),
        ("4.3", "Deploy Production (Canary)"),
        ("4.4", "Rollback Workflow"),
        ("4.5", "Scheduled Maintenance"),
        ("5", "GitHub Actions Workflow Details"),
        ("6", "Workload Identity Federation"),
        ("7", "Canary Deployment Strategy"),
        ("8", "Rollback Procedures"),
        ("9", "Infrastructure Reference"),
        ("10", "Monitoring &amp; Alerting"),
        ("11", "Troubleshooting"),
        ("12", "Post-Deployment Checklist"),
    ]
    toc_data = []
    for num, title in toc_items:
        indent = "&nbsp;&nbsp;&nbsp;&nbsp;" if "." in num else ""
        bold = "Helvetica-Bold" if "." not in num else "Helvetica"
        toc_data.append([
            Paragraph(num, ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=10, textColor=ACCENT)),
            Paragraph(f"{indent}{title}", ParagraphStyle('t', fontName=bold, fontSize=10, textColor=DARK_TEXT)),
        ])
    toc_tbl = Table(toc_data, colWidths=[W * 0.08, W * 0.82])
    toc_tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(toc_tbl)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  1. ARCHITECTURE OVERVIEW
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Architecture Overview", s['SectionTitle']))
    story.append(Paragraph(
        "The HRMS/Payroll/ERP system is deployed on Google Cloud Platform using a serverless-first, "
        "multi-tenant architecture. Each client organization is isolated at the database level via "
        "tenant schemas. The system serves two domains per deployment: <b>hrms.{client-domain}</b> "
        "for the React frontend (via Cloud CDN) and <b>api.hrms.{client-domain}</b> for the Django "
        "REST API (via Cloud Run). Background job processing is handled by Celery workers running "
        "as a separate Cloud Run service.",
        s['Body']
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("1.1 System Architecture Diagram", s['SubSection']))
    arch_lines = [
        "                         Internet",
        "                            |",
        "                +-----------+-----------+",
        "                |                       |",
        "      hrms.{client-domain}    api.hrms.{client-domain}",
        "                |                       |",
        "         Cloud CDN / LB          Cloud Run (API)",
        "                |                   |        |",
        "         GCS (Frontend)      Cloud SQL   Memorystore",
        "         Static Assets       PostgreSQL    Redis 7",
        "                                 |           |",
        "                            Cloud Run (Celery Worker)",
        "                                 |",
        "                            GCS (Media/Exports/Backups)",
    ]
    story.extend(code_block(arch_lines))
    story.append(Spacer(1, 8))

    story.append(Paragraph("1.2 Core Services", s['SubSection']))
    story.append(make_table(
        ["Component", "GCP Service", "Staging", "Production"],
        [
            ["Backend API", "Cloud Run", "0\u20135 instances, 1 vCPU, 1 GiB", "1\u201310 instances, 2 vCPU, 1 GiB"],
            ["Celery Workers", "Cloud Run", "0\u20133 instances, 1 vCPU, 1 GiB", "1\u20135 instances, 2 vCPU, 2 GiB"],
            ["Database", "Cloud SQL PostgreSQL 16", "db-custom-1-3840, ZONAL", "db-custom-4-16384, REGIONAL (HA)"],
            ["Cache", "Memorystore Redis 7", "1 GB, BASIC", "2 GB, STANDARD_HA"],
            ["Frontend", "GCS + Cloud CDN + HTTPS LB", "staging.hrms.{domain}", "hrms.{domain}"],
            ["Container Images", "Artifact Registry", "{project}-staging-docker", "{project}-production-docker"],
            ["Secrets", "Secret Manager", "8 secrets", "8 secrets"],
            ["Networking", "VPC + Serverless Connector", "10.0.0.0/20 + 10.1.0.0/28", "10.0.0.0/20 + 10.1.0.0/28"],
            ["Security", "Cloud Armor WAF", "Basic (SQLi, XSS, rate limit)", "Full OWASP + bot blocking"],
            ["Monitoring", "Cloud Monitoring + Logging", "Email alerts", "Email + Slack alerts"],
            ["IaC", "Terraform >= 1.5", "infra/environments/staging/", "infra/environments/production/"],
            ["CI/CD", "GitHub Actions", "5 workflows", "5 workflows"],
        ],
        col_widths=[W * 0.15, W * 0.22, W * 0.30, W * 0.33],
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("1.3 Terraform Modules (11)", s['SubSection']))
    story.append(Paragraph(
        "All infrastructure is managed as code via Terraform, organized into 11 reusable modules:",
        s['Body']
    ))
    story.append(make_table(
        ["Module", "Purpose"],
        [
            ["networking", "VPC, subnets, serverless VPC connector"],
            ["security", "IAM, service accounts, Cloud Armor, Workload Identity"],
            ["secrets", "Secret Manager (8 secrets per environment)"],
            ["registry", "Artifact Registry for Docker images"],
            ["database", "Cloud SQL PostgreSQL 16 (ZONAL or REGIONAL HA)"],
            ["cache", "Memorystore Redis 7"],
            ["storage", "GCS buckets (media, exports, backups)"],
            ["backend-service", "Cloud Run API + domain mapping"],
            ["worker-service", "Cloud Run Celery worker"],
            ["frontend-cdn", "GCS + CDN + HTTPS LB + SSL certificate"],
            ["monitoring", "Uptime checks, alert policies, dashboard, log metrics"],
        ],
        col_widths=[W * 0.22, W * 0.78],
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  2. PREREQUISITES
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Prerequisites Checklist", s['SectionTitle']))
    story.append(Paragraph(
        "Before starting the deployment, ensure every item below is satisfied. "
        "Missing prerequisites will cause deployment failures.",
        s['Body']
    ))

    story.append(Paragraph("2.1 GCP Requirements", s['SubSection']))
    story.append(bullet("GCP Project created with billing enabled"))
    story.append(sub_bullet("Staging: <b>{project}-staging</b>"))
    story.append(sub_bullet("Production: <b>{project}-production</b>"))
    story.append(bullet("Organization-level access (or sufficient project-level IAM) to enable APIs"))
    story.append(bullet("Billing alert configured (recommended: notify at 50%, 80%, 100%)"))

    story.append(Paragraph("2.2 Local Tooling", s['SubSection']))
    story.append(make_table(
        ["Tool", "Version", "Purpose"],
        [
            ["gcloud CLI", ">= 450.0", "GCP resource management and authentication"],
            ["Terraform", ">= 1.5.0, < 2.0.0", "Infrastructure as Code provisioning"],
            ["Docker", "Latest stable", "Container image building"],
            ["Node.js", "20.x", "Frontend build toolchain"],
            ["Python", "3.12", "Backend local management commands"],
            ["cloud-sql-proxy", "Latest", "Local database access via proxy"],
        ],
        col_widths=[W * 0.20, W * 0.25, W * 0.55],
    ))

    story.append(Paragraph("2.3 GitHub Requirements", s['SubSection']))
    story.append(bullet("GitHub repository with Actions enabled (e.g. <b>{org}/hrms</b>)"))
    story.append(bullet("Branch protection configured on <b>main</b> (require PR reviews)"))
    story.append(bullet("GitHub Environments created: <b>staging</b> and <b>production</b>"))
    story.append(bullet("Production environment should have <b>required reviewers</b> configured"))

    story.append(Paragraph("2.4 Domain &amp; DNS", s['SubSection']))
    story.append(bullet("Domain access for the client's DNS zone"))
    story.append(bullet("Ability to create A/CNAME records for:"))
    story.append(sub_bullet("hrms.{client-domain} (production frontend)"))
    story.append(sub_bullet("staging.hrms.{client-domain} (staging frontend)"))
    story.append(sub_bullet("api.hrms.{client-domain} (production API)"))
    story.append(sub_bullet("api.staging.hrms.{client-domain} (staging API)"))

    story.append(Paragraph("2.5 Notification Channels", s['SubSection']))
    story.append(bullet("Email address for alert notifications (e.g. <b>devops@{client-domain}</b>)"))
    story.append(bullet("Slack webhook URL (optional, for critical production alerts to <b>#hrms-alerts</b>)"))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  3. STEP-BY-STEP FIRST DEPLOYMENT
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Step-by-Step First Deployment", s['SectionTitle']))
    story.append(Paragraph(
        "This section provides a complete walkthrough for deploying the HRMS/Payroll/ERP system to GCP for the "
        "first time. All commands assume you are in the repository root unless otherwise specified.",
        s['Body']
    ))

    # 3.1 Bootstrap
    story.append(Paragraph("3.1 Bootstrap GCP Project", s['SubSection']))
    story.append(Paragraph(
        "This step enables required GCP APIs, creates the Terraform state bucket, and creates the "
        "Terraform service account. Perform this for each GCP project (staging and production).",
        s['Body']
    ))

    story.append(Paragraph("Step 1: Set Environment Variables", s['SubSubSection']))
    story.extend(code_block([
        'export PROJECT_ID="{project}-staging"          # e.g. "acme-hrms-staging"',
        'export REGION="us-central1"                    # or your preferred region',
        'export TF_STATE_BUCKET="{project}-terraform-state-staging"',
        '',
        'gcloud auth login',
        'gcloud config set project $PROJECT_ID',
    ]))

    story.append(Paragraph("Step 2: Enable Required GCP APIs", s['SubSubSection']))
    story.extend(code_block([
        "gcloud services enable \\",
        "  run.googleapis.com \\",
        "  sqladmin.googleapis.com \\",
        "  redis.googleapis.com \\",
        "  artifactregistry.googleapis.com \\",
        "  secretmanager.googleapis.com \\",
        "  compute.googleapis.com \\",
        "  vpcaccess.googleapis.com \\",
        "  servicenetworking.googleapis.com \\",
        "  cloudresourcemanager.googleapis.com \\",
        "  iam.googleapis.com \\",
        "  iamcredentials.googleapis.com \\",
        "  monitoring.googleapis.com \\",
        "  logging.googleapis.com \\",
        "  cloudbuild.googleapis.com \\",
        "  containerscanning.googleapis.com \\",
        "  --project=$PROJECT_ID",
    ]))

    story.append(Paragraph("Step 3: Create Terraform State Bucket", s['SubSubSection']))
    story.extend(code_block([
        "gcloud storage buckets create gs://$TF_STATE_BUCKET \\",
        "  --project=$PROJECT_ID \\",
        "  --location=$REGION \\",
        "  --uniform-bucket-level-access \\",
        "  --public-access-prevention",
        "",
        "# Enable versioning for state recovery",
        "gcloud storage buckets update gs://$TF_STATE_BUCKET --versioning",
    ]))

    story.append(Paragraph("Step 4: Create Terraform Service Account", s['SubSubSection']))
    story.append(Paragraph(
        "Create a service account with the required roles for Terraform to manage all GCP resources:",
        s['Body']
    ))
    story.extend(code_block([
        "gcloud iam service-accounts create terraform \\",
        '  --display-name="Terraform" --project=$PROJECT_ID',
        "",
        "# Grant required roles",
        "for ROLE in roles/editor roles/iam.securityAdmin \\",
        "  roles/secretmanager.admin roles/compute.networkAdmin \\",
        "  roles/run.admin roles/cloudsql.admin roles/redis.admin \\",
        "  roles/storage.admin roles/monitoring.admin \\",
        "  roles/logging.admin roles/artifactregistry.admin \\",
        "  roles/iam.workloadIdentityPoolAdmin; do",
        "  gcloud projects add-iam-policy-binding $PROJECT_ID \\",
        '    --member="serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com" \\',
        '    --role="$ROLE" --quiet',
        "done",
    ]))
    story.append(warn_box(
        "Delete local service account keys after initial bootstrapping. "
        "Once Workload Identity Federation is configured, GitHub Actions uses OIDC tokens instead."
    ))
    story.append(PageBreak())

    # 3.2 GitHub Secrets
    story.append(Paragraph("3.2 Configure GitHub Secrets", s['SubSection']))
    story.append(Paragraph(
        "Navigate to GitHub > Repository Settings > Secrets and Variables > Actions and configure "
        "the following secrets and variables.",
        s['Body']
    ))

    story.append(Paragraph("Repository-Level Secrets (Shared)", s['SubSubSection']))
    story.append(make_table(
        ["Secret Name", "Description"],
        [
            ["GCP_WORKLOAD_IDENTITY_PROVIDER", "Workload Identity Provider resource name (from Terraform output)"],
            ["GCP_SERVICE_ACCOUNT_EMAIL", "CI/CD service account email (from Terraform output)"],
        ],
        col_widths=[W * 0.40, W * 0.60],
    ))

    story.append(Paragraph("Environment-Level Secrets", s['SubSubSection']))
    story.append(make_table(
        ["Secret Name", "Staging Value", "Production Value"],
        [
            ["GCP_PROJECT_ID_*", "{project}-staging", "{project}-production"],
            ["GCP_WORKLOAD_IDENTITY_PROVIDER", "(staging pool)", "(production pool)"],
            ["GCP_SERVICE_ACCOUNT_EMAIL", "(staging CI/CD SA)", "(production CI/CD SA)"],
        ],
        col_widths=[W * 0.35, W * 0.30, W * 0.35],
    ))

    story.append(Paragraph("Environment-Level Variables", s['SubSubSection']))
    story.append(make_table(
        ["Variable", "Staging", "Production"],
        [
            ["GCP_REGION", "us-central1", "us-central1"],
            ["STAGING_API_URL", "https://api.staging.hrms.{domain}", "\u2014"],
            ["STAGING_BUCKET", "{project}-staging-frontend", "\u2014"],
            ["PRODUCTION_API_URL", "\u2014", "https://api.hrms.{domain}"],
            ["PRODUCTION_BUCKET", "\u2014", "{project}-production-frontend"],
            ["SLACK_WEBHOOK_URL", "(optional)", "(recommended)"],
        ],
        col_widths=[W * 0.30, W * 0.35, W * 0.35],
    ))
    story.append(tip_box(
        "The Workload Identity Provider and CI/CD service account are created by Terraform. "
        "On the first deploy, bootstrap manually or use a temporary service account key, "
        "then update these secrets after terraform apply."
    ))

    # 3.3 Deploy Infrastructure
    story.append(Paragraph("3.3 Deploy Infrastructure with Terraform", s['SubSection']))
    story.append(Paragraph(
        "All Terraform operations use the Makefile in the <b>infra/</b> directory. "
        "The Makefile validates that ENV is set and that the corresponding environment config exists.",
        s['Body']
    ))
    story.extend(code_block([
        "cd infra",
        "",
        "# Step 1: Initialize Terraform for staging",
        "make init ENV=staging",
        "",
        "# Step 2: Review the execution plan",
        "make plan ENV=staging",
        "",
        "# Step 3: Apply (after careful review)",
        "make apply ENV=staging",
    ]))

    story.append(Paragraph("Expected Resources Created (First Run)", s['SubSubSection']))
    story.append(bullet("1 VPC network + subnet + serverless VPC connector"))
    story.append(bullet("2 service accounts (API + Worker) + 1 CI/CD service account"))
    story.append(bullet("1 Cloud Armor WAF policy"))
    story.append(bullet("1 Workload Identity Pool + Provider (for GitHub Actions)"))
    story.append(bullet("8 Secret Manager secrets (empty \u2014 populate in step 3.5)"))
    story.append(bullet("1 Artifact Registry repository"))
    story.append(bullet("1 Cloud SQL PostgreSQL instance"))
    story.append(bullet("1 Memorystore Redis instance"))
    story.append(bullet("3 GCS buckets (media, exports, backups)"))
    story.append(bullet("Cloud Run API + Worker services"))
    story.append(bullet("GCS frontend bucket + CDN + HTTPS LB + SSL certificate"))
    story.append(bullet("Monitoring: uptime checks, 16 alert policies, 4 log metrics, 1 dashboard"))

    story.append(Spacer(1, 6))
    story.extend(code_block([
        "# Save outputs (you will need them for subsequent steps)",
        "make output ENV=staging",
    ]))
    story.append(warn_box(
        "Cloud Run requires a container image to exist. If Terraform partially fails because "
        "the Artifact Registry is empty, proceed to step 3.4 to push an initial image, "
        "then re-run make apply ENV=staging."
    ))
    story.append(PageBreak())

    # 3.4 Docker Images
    story.append(Paragraph("3.4 Build &amp; Push Docker Images", s['SubSection']))
    story.append(Paragraph(
        "Before Cloud Run can start, it needs at least one container image in Artifact Registry.",
        s['Body']
    ))
    story.extend(code_block([
        '# Variables (from Terraform output)',
        'export PROJECT_ID="{project}-staging"',
        'export REGION="us-central1"',
        'export REGISTRY="${REGION}-docker.pkg.dev"',
        'export REPOSITORY="${PROJECT_ID}/{project}-staging-docker"',
        '',
        '# Authenticate Docker to Artifact Registry',
        'gcloud auth configure-docker ${REGISTRY} --quiet',
        '',
        '# Build and push the backend API image',
        'docker build \\',
        '  -t ${REGISTRY}/${REPOSITORY}/backend:initial \\',
        '  -t ${REGISTRY}/${REPOSITORY}/backend:latest \\',
        '  ./HRMS/backend',
        '',
        'docker push ${REGISTRY}/${REPOSITORY}/backend:initial',
        'docker push ${REGISTRY}/${REPOSITORY}/backend:latest',
        '',
        '# Build and push the Celery worker image',
        'docker build \\',
        '  -t ${REGISTRY}/${REPOSITORY}/celery-worker:initial \\',
        '  -t ${REGISTRY}/${REPOSITORY}/celery-worker:latest \\',
        '  -f ./HRMS/backend/Dockerfile.celery \\',
        '  ./HRMS/backend',
        '',
        'docker push ${REGISTRY}/${REPOSITORY}/celery-worker:initial',
        'docker push ${REGISTRY}/${REPOSITORY}/celery-worker:latest',
    ]))
    story.append(tip_box(
        "After this initial push, all subsequent image builds are handled by GitHub Actions "
        "CI/CD (deploy-staging.yml and deploy-production.yml)."
    ))

    # 3.5 Secrets
    story.append(Paragraph("3.5 Configure Secrets in Secret Manager", s['SubSection']))
    story.append(Paragraph(
        "Terraform created 8 empty secrets. You must add the initial secret values manually.",
        s['Body']
    ))
    story.append(make_table(
        ["Secret ID Pattern", "Description", "Generation Method"],
        [
            ["*-django-secret-key", "Django SECRET_KEY", "python3 -c 'import secrets; print(secrets.token_urlsafe(64))'"],
            ["*-db-password", "Cloud SQL database password", "python3 -c 'import secrets; print(secrets.token_urlsafe(32))'"],
            ["*-redis-auth", "Memorystore Redis AUTH", "python3 -c 'import secrets; print(secrets.token_urlsafe(32))'"],
            ["*-jwt-signing-key", "JWT token signing key", "python3 -c 'import secrets; print(secrets.token_urlsafe(64))'"],
            ["*-anthropic-api-key", "Anthropic API key", "From Anthropic account dashboard"],
            ["*-email-host-password", "SMTP email password", "From SMTP provider"],
            ["*-ldap-bind-password", "LDAP bind password", "From Active Directory admin"],
            ["*-azure-client-secret", "Azure AD client secret", "From Azure portal"],
        ],
        col_widths=[W * 0.25, W * 0.28, W * 0.47],
    ))
    story.append(Spacer(1, 4))
    story.extend(code_block([
        "# Example: Set Django secret key",
        'echo -n "$(python3 -c \'import secrets; print(secrets.token_urlsafe(64))\')" | \\',
        '  gcloud secrets versions add "${PREFIX}-django-secret-key" \\',
        '    --data-file=- --project=$PROJECT_ID',
    ]))
    story.append(critical_box(
        "You must also set the database password on the Cloud SQL instance itself using "
        "gcloud sql users set-password. Use the SAME password stored in Secret Manager."
    ))

    # 3.6 Migrations
    story.append(Paragraph("3.6 Run Initial Migrations", s['SubSection']))
    story.append(Paragraph(
        "Database migrations must be applied before the API can serve requests.",
        s['Body']
    ))
    story.append(Paragraph("Option A: Via Cloud Run Job (Preferred)", s['SubSubSection']))
    story.extend(code_block([
        "gcloud run jobs execute ${PROJECT_ID}-api-migrate \\",
        "  --region=$REGION --project=$PROJECT_ID --wait",
    ]))
    story.append(Paragraph("Option B: Via Cloud SQL Auth Proxy (Local)", s['SubSubSection']))
    story.extend(code_block([
        '# Start proxy',
        'CONN_NAME=$(cd infra && terraform output -raw db_connection_name)',
        'cloud-sql-proxy $CONN_NAME --port=5432 &',
        '',
        '# Run migrations',
        'cd HRMS/backend',
        'export DJANGO_ENV=production USE_POSTGRES=true',
        'export DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=hrms DB_USER=hrms_app',
        'export DB_PASSWORD="<from-secret-manager>"',
        'python manage.py migrate --noinput',
    ]))

    # 3.7 Superuser + Seed
    story.append(Paragraph("3.7 Create Superuser &amp; Load Seed Data", s['SubSection']))
    story.extend(code_block([
        "# Create superuser",
        'python manage.py shell -c "',
        "from accounts.models import User",
        "if not User.objects.filter(email='admin@{domain}').exists():",
        "    User.objects.create_superuser(",
        "        email='admin@{domain}',",
        "        username='system-admin',",
        "        password='CHANGE-ME-ON-FIRST-LOGIN',",
        '    )"',
    ]))
    story.append(critical_box("Change the superuser password immediately after first login."))
    story.append(Spacer(1, 6))
    story.extend(code_block([
        "# Load seed data (idempotent)",
        "./scripts/deployment/seed-production.sh --env staging --proxy",
    ]))
    story.append(PageBreak())

    # 3.8 Frontend
    story.append(Paragraph("3.8 Build &amp; Upload Frontend", s['SubSection']))
    story.append(Paragraph(
        "The frontend is a React/Vite SPA served from GCS via Cloud CDN.",
        s['Body']
    ))
    story.extend(code_block([
        "cd HRMS/frontend",
        "npm ci",
        "VITE_API_URL=https://api.staging.hrms.{domain} npm run build",
        "",
        'BUCKET="${PROJECT_ID}-frontend"',
        "",
        "# Static assets: immutable, 1-year cache",
        'gcloud storage cp dist/assets/* "gs://${BUCKET}/assets/" \\',
        '  --recursive --cache-control="public, max-age=31536000, immutable"',
        "",
        "# HTML: no cache (always fetch latest)",
        'gcloud storage cp dist/index.html "gs://${BUCKET}/" \\',
        '  --cache-control="no-cache, no-store, must-revalidate"',
        "",
        "# Invalidate CDN cache",
        "gcloud compute url-maps invalidate-cdn-cache \\",
        '  ${PROJECT_ID}-frontend-urlmap --path="/index.html" \\',
        "  --project=$PROJECT_ID --async",
    ]))

    # 3.9 DNS + SSL
    story.append(Paragraph("3.9 Configure DNS &amp; Verify SSL", s['SubSection']))
    story.append(Paragraph("DNS Records to Create", s['SubSubSection']))
    story.append(make_table(
        ["Type", "Host", "Value", "TTL"],
        [
            ["A", "staging.hrms.{domain}", "<cdn_ip_address> (from terraform output)", "300"],
            ["A", "hrms.{domain}", "<cdn_ip_address>", "300"],
            ["CNAME", "api.staging.hrms.{domain}", "ghs.googlehosted.com.", "300"],
            ["CNAME", "api.hrms.{domain}", "ghs.googlehosted.com.", "300"],
            ["CNAME", "www.hrms.{domain}", "hrms.{domain}", "3600"],
            ["CAA", "hrms.{domain}", '0 issue "pki.goog"', "3600"],
        ],
        col_widths=[W * 0.10, W * 0.32, W * 0.42, W * 0.08],
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Google-managed SSL certificates are provisioned automatically. Certificate provisioning "
        "typically takes 15\u201360 minutes after DNS propagation but can take up to 24 hours.",
        s['Body']
    ))
    story.extend(code_block([
        "# Verify DNS",
        "dig staging.hrms.{domain} +short",
        "dig api.staging.hrms.{domain} +short",
        "",
        "# Check SSL certificate status",
        "gcloud compute ssl-certificates list --project=$PROJECT_ID \\",
        '  --format="table(name, type, managed.status, managed.domainStatus)"',
    ]))

    # 3.10 Smoke Tests
    story.append(Paragraph("3.10 Smoke Tests", s['SubSection']))
    story.append(make_table(
        ["Test", "Command", "Expected"],
        [
            ["API Health", "curl -s -o /dev/null -w '%{http_code}' ${API_URL}/healthz/", "200"],
            ["API Readiness", "curl -s ${API_URL}/readyz/ | python3 -m json.tool", "JSON with DB+Redis status"],
            ["Frontend", "curl -s -o /dev/null -w '%{http_code}' https://staging.hrms.{domain}", "200"],
            ["Worker", "gcloud run services describe ${PROJECT_ID}-worker ...", "status: True"],
            ["Cache", "curl ${API_URL}/api/v1/core/cache/stats/ -H 'Authorization: Bearer ...'", "JSON stats"],
        ],
        col_widths=[W * 0.12, W * 0.58, W * 0.30],
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  4. CI/CD PIPELINE REFERENCE
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("4. CI/CD Pipeline Reference", s['SectionTitle']))
    story.append(Paragraph(
        "The project uses 5 GitHub Actions workflows that automate the entire build, test, and "
        "deployment lifecycle. All workflows are stored in <b>.github/workflows/</b>.",
        s['Body']
    ))

    # 4.1 CI
    story.append(Paragraph("4.1 CI Pipeline", s['SubSection']))
    story.append(Paragraph("<b>File:</b> .github/workflows/ci.yml", s['Body']))
    story.append(Paragraph("<b>Triggers:</b> Pull requests to develop and main", s['Body']))
    story.append(make_table(
        ["Job", "Description", "Key Tools"],
        [
            ["backend-lint", "Ruff lint + format check, Bandit security scan", "Ruff, Bandit"],
            ["backend-test", "Django test suite with PostgreSQL 16 + Redis 7", "pytest, coverage >= 80%"],
            ["backend-security", "Dependency vulnerability scan", "pip-audit"],
            ["frontend-lint", "ESLint + TypeScript type check", "ESLint, tsc --noEmit"],
            ["frontend-build", "Vite production build verification", "npm run build"],
            ["frontend-security", "Frontend dependency audit", "npm audit"],
            ["docker-build", "Verify Dockerfiles build successfully", "docker build"],
        ],
        col_widths=[W * 0.20, W * 0.50, W * 0.30],
    ))
    story.append(Spacer(1, 4))
    story.append(tip_box(
        "CI runs automatically on every pull request. All 7 jobs must pass before merging is allowed."
    ))

    # 4.2 Deploy Staging
    story.append(Paragraph("4.2 Deploy Staging", s['SubSection']))
    story.append(Paragraph("<b>File:</b> .github/workflows/deploy-staging.yml", s['Body']))
    story.append(Paragraph("<b>Triggers:</b> Push to develop branch", s['Body']))
    story.append(Paragraph("<b>Flow:</b>", s['Body']))
    flow_steps = [
        "1. Run CI checks (lint, test, security, build)",
        "2. Build &amp; push Docker images to Artifact Registry",
        "3. Run database migrations via Cloud Run Job",
        "4. Deploy API to Cloud Run (canary then 100%)",
        "5. Build &amp; upload frontend to GCS",
        "6. Invalidate CDN cache",
        "7. Run smoke tests",
        "8. Send Slack notification (if configured)",
    ]
    for step in flow_steps:
        story.append(bullet(step))

    # 4.3 Deploy Production
    story.append(Paragraph("4.3 Deploy Production (Canary)", s['SubSection']))
    story.append(Paragraph("<b>File:</b> .github/workflows/deploy-production.yml", s['Body']))
    story.append(Paragraph("<b>Triggers:</b> Push to main branch", s['Body']))
    story.append(Paragraph(
        "Production deployments use a canary strategy with automatic rollback. The workflow "
        "requires manual approval from designated reviewers before proceeding.",
        s['Body']
    ))
    story.append(Paragraph("<b>Production-Specific Steps:</b>", s['Body']))
    prod_steps = [
        "1. CI checks (all 7 jobs must pass)",
        "2. Build &amp; push Docker images",
        "3. <b>Pre-deploy database backup</b> (automatic snapshot)",
        "4. Run database migrations",
        "5. <b>Canary deployment</b> (0% \u2192 10% \u2192 50% \u2192 100%)",
        "6. Deploy frontend + invalidate CDN",
        "7. Run smoke tests",
        "8. <b>Create Git tag + GitHub Release</b>",
        "9. Slack notification",
    ]
    for step in prod_steps:
        story.append(bullet(step))

    # 4.4 Rollback
    story.append(Paragraph("4.4 Rollback Workflow", s['SubSection']))
    story.append(Paragraph("<b>File:</b> .github/workflows/rollback.yml", s['Body']))
    story.append(Paragraph("<b>Triggers:</b> Manual dispatch (workflow_dispatch)", s['Body']))
    story.append(make_table(
        ["Input", "Type", "Description"],
        [
            ["environment", "Choice", "staging or production"],
            ["revision", "String", "Cloud Run revision name or 'previous'"],
            ["reason", "String", "Required text explanation for the rollback"],
        ],
        col_widths=[W * 0.18, W * 0.15, W * 0.67],
    ))
    story.append(Paragraph(
        "<b>Actions:</b> Shifts traffic to specified revision, invalidates CDN, verifies health, notifies Slack.",
        s['Body']
    ))

    # 4.5 Scheduled Maintenance
    story.append(Paragraph("4.5 Scheduled Maintenance", s['SubSection']))
    story.append(Paragraph("<b>File:</b> .github/workflows/scheduled-maintenance.yml", s['Body']))
    story.append(make_table(
        ["Schedule", "Frequency", "Action"],
        [
            ["Mon 06:00 UTC", "Weekly", "Python + Node.js dependency vulnerability audit"],
            ["Daily 08:00 UTC", "Daily", "Verify production Cloud SQL backup exists and is < 25h old"],
            ["1st of month 09:00 UTC", "Monthly", "Service account key rotation audit"],
        ],
        col_widths=[W * 0.22, W * 0.15, W * 0.63],
    ))
    story.append(Paragraph(
        "Creates GitHub issues automatically if vulnerabilities or backup failures are detected.",
        s['Body']
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  5. GITHUB ACTIONS WORKFLOW DETAILS
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("5. GitHub Actions Workflow Details", s['SectionTitle']))
    story.append(Paragraph(
        "This section provides detailed implementation guidance for each GitHub Actions workflow.",
        s['Body']
    ))

    story.append(Paragraph("5.1 Authentication: Workload Identity Federation", s['SubSection']))
    story.append(Paragraph(
        "GitHub Actions authenticates to GCP using Workload Identity Federation (WIF), eliminating "
        "the need for long-lived service account keys. This is the recommended and most secure approach.",
        s['Body']
    ))
    story.extend(code_block([
        "# In every workflow job that interacts with GCP:",
        "- uses: google-github-actions/auth@v2",
        "  with:",
        "    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}",
        "    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}",
        "",
        "# Setup gcloud CLI",
        "- uses: google-github-actions/setup-gcloud@v2",
        "  with:",
        "    project_id: ${{ vars.GCP_PROJECT_ID }}",
    ]))

    story.append(Paragraph("How WIF Works", s['SubSubSection']))
    story.append(bullet("GitHub OIDC provider issues a short-lived JWT token to the workflow"))
    story.append(bullet("The token is exchanged with GCP's Security Token Service (STS)"))
    story.append(bullet("STS validates the token against the Workload Identity Pool/Provider"))
    story.append(bullet("A federated access token is returned, scoped to the CI/CD service account"))
    story.append(bullet("No service account keys are stored in GitHub Secrets"))
    story.append(Spacer(1, 4))
    story.append(tip_box(
        "Workload Identity Federation is configured by the Terraform 'security' module. "
        "The pool and provider are automatically created during terraform apply."
    ))

    story.append(Paragraph("5.2 Docker Image Build &amp; Push", s['SubSection']))
    story.extend(code_block([
        "# Build step in deploy workflow",
        "- name: Configure Docker for Artifact Registry",
        "  run: gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet",
        "",
        "- name: Build and push API image",
        "  run: |",
        "    docker build \\",
        "      -t ${REGISTRY}/${REPOSITORY}/backend:${GITHUB_SHA::8} \\",
        "      -t ${REGISTRY}/${REPOSITORY}/backend:latest \\",
        "      ./HRMS/backend",
        "    docker push ${REGISTRY}/${REPOSITORY}/backend --all-tags",
        "",
        "- name: Build and push Worker image",
        "  run: |",
        "    docker build \\",
        "      -t ${REGISTRY}/${REPOSITORY}/celery-worker:${GITHUB_SHA::8} \\",
        "      -t ${REGISTRY}/${REPOSITORY}/celery-worker:latest \\",
        "      -f ./HRMS/backend/Dockerfile.celery \\",
        "      ./HRMS/backend",
        "    docker push ${REGISTRY}/${REPOSITORY}/celery-worker --all-tags",
    ]))
    story.append(Paragraph(
        "Images are tagged with both the short commit SHA (for traceability) and <b>latest</b> "
        "(for convenience). Artifact Registry retains all versions.",
        s['Body']
    ))

    story.append(Paragraph("5.3 Database Migration Job", s['SubSection']))
    story.extend(code_block([
        "- name: Run migrations",
        "  run: |",
        "    gcloud run jobs execute ${PROJECT_PREFIX}-${ENV}-api-migrate \\",
        "      --region=${{ vars.GCP_REGION }} \\",
        "      --project=${{ vars.GCP_PROJECT_ID }} \\",
        "      --wait",
    ]))
    story.append(Paragraph(
        "The migration Cloud Run Job is defined in Terraform. It uses the same container image "
        "as the API but runs <b>python manage.py migrate --noinput</b> as its entrypoint. "
        "The job has access to the database via the VPC connector and reads credentials from Secret Manager.",
        s['Body']
    ))

    story.append(Paragraph("5.4 Frontend Deploy Step", s['SubSection']))
    story.extend(code_block([
        "- name: Build frontend",
        "  working-directory: HRMS/frontend",
        "  run: |",
        "    npm ci",
        "    VITE_API_URL=${{ vars.API_URL }} npm run build",
        "",
        "- name: Upload to GCS",
        "  run: |",
        "    # Static assets with immutable caching",
        "    gcloud storage cp dist/assets/* gs://${BUCKET}/assets/ \\",
        '      --recursive --cache-control="public, max-age=31536000, immutable"',
        "    # HTML with no-cache",
        "    gcloud storage cp dist/index.html gs://${BUCKET}/ \\",
        '      --cache-control="no-cache, no-store, must-revalidate"',
        "",
        "- name: Invalidate CDN",
        "  run: |",
        "    gcloud compute url-maps invalidate-cdn-cache \\",
        "      ${PROJECT_PREFIX}-${ENV}-frontend-urlmap \\",
        '      --path="/index.html" --project=$PROJECT_ID --async',
    ]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  6. WORKLOAD IDENTITY FEDERATION (DETAILED)
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Workload Identity Federation", s['SectionTitle']))
    story.append(Paragraph(
        "Workload Identity Federation allows GitHub Actions to authenticate to GCP without "
        "long-lived service account keys. This section details the setup and security model.",
        s['Body']
    ))

    story.append(Paragraph("6.1 Architecture", s['SubSection']))
    story.extend(code_block([
        "GitHub Actions Runner",
        "  |",
        "  | (1) Request OIDC token from GitHub",
        "  v",
        "GitHub OIDC Provider  -->  JWT with claims:",
        "  |                        - iss: https://token.actions.githubusercontent.com",
        "  |                        - sub: repo:{org}/hrms:ref:refs/heads/develop",
        "  |                        - aud: https://iam.googleapis.com/...",
        "  |",
        "  | (2) Exchange JWT for GCP access token",
        "  v",
        "GCP Security Token Service (STS)",
        "  |",
        "  | (3) Validate against Workload Identity Pool",
        "  v",
        "Workload Identity Pool + Provider",
        "  |",
        "  | (4) Return federated access token",
        "  v",
        "CI/CD Service Account  -->  Scoped permissions",
    ]))

    story.append(Paragraph("6.2 Terraform Configuration (security module)", s['SubSection']))
    story.append(Paragraph(
        "The Terraform security module creates the following resources:",
        s['Body']
    ))
    story.append(bullet("<b>Workload Identity Pool:</b> {project}-{env}-github-pool"))
    story.append(bullet("<b>Workload Identity Provider:</b> {project}-{env}-github-provider"))
    story.append(bullet("<b>CI/CD Service Account:</b> {project}-{env}-cicd-sa"))
    story.append(bullet("<b>Attribute mapping:</b> google.subject = assertion.sub"))
    story.append(bullet("<b>Attribute condition:</b> assertion.repository == '{org}/hrms'"))
    story.append(Spacer(1, 4))
    story.append(warn_box(
        "The attribute condition restricts authentication to your specific repository only. "
        "No other repository can impersonate the CI/CD service account."
    ))

    story.append(Paragraph("6.3 CI/CD Service Account Roles", s['SubSection']))
    story.append(make_table(
        ["Role", "Purpose"],
        [
            ["roles/run.admin", "Deploy and manage Cloud Run services"],
            ["roles/artifactregistry.writer", "Push Docker images"],
            ["roles/storage.objectAdmin", "Upload frontend to GCS, manage media"],
            ["roles/secretmanager.secretAccessor", "Read secrets for deployment"],
            ["roles/cloudsql.client", "Connect to Cloud SQL for migrations"],
            ["roles/compute.urlMapUpdater", "Invalidate CDN cache"],
            ["roles/monitoring.viewer", "Read metrics for canary decision"],
            ["roles/iam.serviceAccountUser", "Act as API/Worker service accounts"],
        ],
        col_widths=[W * 0.35, W * 0.65],
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  7. CANARY DEPLOYMENT STRATEGY
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("7. Canary Deployment Strategy", s['SectionTitle']))
    story.append(Paragraph(
        "Production deployments use a gradual traffic shifting (canary) strategy with automatic "
        "rollback based on error rate monitoring. This minimizes blast radius when deploying "
        "potentially breaking changes.",
        s['Body']
    ))

    story.append(Paragraph("7.1 Traffic Shifting Stages", s['SubSection']))
    story.append(make_table(
        ["Stage", "Traffic %", "Duration", "Success Criteria", "Failure Action"],
        [
            ["Deploy", "0%", "Immediate", "Revision created successfully", "Abort deployment"],
            ["Canary", "10%", "5 minutes", "Error rate < 1%", "Auto-rollback to previous"],
            ["Ramp", "50%", "5 minutes", "Error rate < 1%", "Auto-rollback to previous"],
            ["Full", "100%", "Permanent", "Deployment complete", "\u2014"],
        ],
        col_widths=[W * 0.10, W * 0.12, W * 0.13, W * 0.35, W * 0.30],
    ))

    story.append(Paragraph("7.2 Error Rate Monitoring", s['SubSection']))
    story.append(Paragraph(
        "During each canary stage, the workflow queries Cloud Monitoring for the error rate "
        "(5xx responses / total responses) over the monitoring window:",
        s['Body']
    ))
    story.extend(code_block([
        "# Query error rate from Cloud Monitoring",
        "ERROR_RATE=$(gcloud monitoring time-series list \\",
        "  --project=$PROJECT_ID \\",
        '  --filter="resource.type=cloud_run_revision AND',
        '           metric.type=run.googleapis.com/request_count AND',
        '           resource.labels.service_name=$SERVICE AND',
        '           metric.labels.response_code_class=5xx" \\',
        "  --interval-start=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \\",
        "  --format=json | jq '...')",
        "",
        'if [ "$(echo "$ERROR_RATE > 0.01" | bc)" -eq 1 ]; then',
        "  echo 'Error rate exceeds 1%. Rolling back...'",
        "  gcloud run services update-traffic $SERVICE \\",
        '    --to-revisions=${PREV_REVISION}=100 ...',
        "fi",
    ]))

    story.append(Paragraph("7.3 Rollback Flow", s['SubSection']))
    story.extend(code_block([
        "Canary Error Rate > 1%",
        "  |",
        "  +--> Shift 100% traffic to previous revision",
        "  +--> Invalidate CDN cache",
        "  +--> Send Slack alert with failure details",
        "  +--> Mark GitHub Actions workflow as failed",
        "  +--> Create GitHub issue for investigation",
    ]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  8. ROLLBACK PROCEDURES
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("8. Rollback Procedures", s['SectionTitle']))

    story.append(Paragraph("8.1 Cloud Run API Rollback", s['SubSection']))
    story.append(Paragraph("<b>Option A: Via GitHub Actions (Recommended)</b>", s['Body']))
    story.append(Paragraph(
        "Go to Actions > Rollback > Run workflow, select the environment, and specify "
        "<b>previous</b> or a specific revision name.",
        s['Body']
    ))
    story.append(Paragraph("<b>Option B: Via CLI</b>", s['Body']))
    story.extend(code_block([
        "# List recent revisions",
        "gcloud run revisions list --service=$SERVICE \\",
        "  --region=$REGION --project=$PROJECT_ID \\",
        '  --sort-by="~metadata.creationTimestamp" --limit=5',
        "",
        "# Roll back to specific revision",
        "gcloud run services update-traffic $SERVICE \\",
        '  --to-revisions="${PREV_REVISION}=100" \\',
        "  --region=$REGION --project=$PROJECT_ID",
    ]))

    story.append(Paragraph("8.2 Database Rollback", s['SubSection']))
    story.append(make_table(
        ["Method", "Use Case", "Downtime"],
        [
            ["Reverse Django migration", "Known migration caused the issue", "None (online)"],
            ["Point-in-time recovery (PITR)", "Data corruption, accidental deletes", "Minutes (clone + swap)"],
            ["Backup restore", "Full recovery needed", "Yes (replaces all data)"],
        ],
        col_widths=[W * 0.25, W * 0.45, W * 0.30],
    ))

    story.append(Paragraph("8.3 Frontend Rollback", s['SubSection']))
    story.append(Paragraph(
        "Re-upload the previous build artifacts to GCS and invalidate the CDN cache:",
        s['Body']
    ))
    story.extend(code_block([
        '# Re-upload previous build',
        'gcloud storage cp /path/to/previous/dist/assets/* "gs://${BUCKET}/assets/" \\',
        '  --recursive --cache-control="public, max-age=31536000, immutable"',
        'gcloud storage cp /path/to/previous/dist/index.html "gs://${BUCKET}/" \\',
        '  --cache-control="no-cache, no-store, must-revalidate"',
        "",
        "# Invalidate CDN",
        "gcloud compute url-maps invalidate-cdn-cache \\",
        '  ${PROJECT_PREFIX}-production-frontend-urlmap --path="/*" \\',
        "  --project=$PROJECT_ID --async",
    ]))

    story.append(Paragraph("8.4 Emergency Kill Switch", s['SubSection']))
    story.append(critical_box(
        "Use only when the application is causing active harm and must be stopped immediately."
    ))
    story.extend(code_block([
        "# Scale API and worker to zero (takes effect within seconds)",
        "gcloud run services update ${PROJECT_PREFIX}-production-api \\",
        "  --min-instances=0 --max-instances=0 \\",
        "  --region=$REGION --project=$PROJECT_ID",
        "",
        "gcloud run services update ${PROJECT_PREFIX}-production-worker \\",
        "  --min-instances=0 --max-instances=0 \\",
        "  --region=$REGION --project=$PROJECT_ID",
    ]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  9. INFRASTRUCTURE REFERENCE
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("9. Infrastructure Reference", s['SectionTitle']))

    story.append(Paragraph("9.1 Terraform State", s['SubSection']))
    story.append(make_table(
        ["Environment", "State Bucket", "Prefix"],
        [
            ["Staging", "{project}-terraform-state-staging", "terraform/state"],
            ["Production", "{project}-terraform-state-production", "terraform/state"],
        ],
        col_widths=[W * 0.18, W * 0.52, W * 0.30],
    ))

    story.append(Paragraph("9.2 Makefile Targets", s['SubSection']))
    story.append(make_table(
        ["Target", "Description"],
        [
            ["make init ENV=<env>", "Initialize Terraform backend"],
            ["make plan ENV=<env>", "Generate execution plan"],
            ["make apply ENV=<env>", "Apply changes"],
            ["make output ENV=<env>", "Show outputs"],
            ["make destroy ENV=<env>", "Destroy all resources (requires confirmation)"],
            ["make state-list ENV=<env>", "List all resources in state"],
            ["make fmt", "Format all .tf files"],
            ["make validate", "Validate configuration"],
            ["make staging-plan", "Shortcut: init + plan for staging"],
            ["make staging-apply", "Shortcut: init + apply for staging"],
            ["make production-plan", "Shortcut: init + plan for production"],
            ["make production-apply", "Shortcut: init + apply for production"],
        ],
        col_widths=[W * 0.35, W * 0.65],
    ))

    story.append(Paragraph("9.3 Secret Manager Secrets (8 per environment)", s['SubSection']))
    story.append(make_table(
        ["Secret ID Pattern", "Description", "Used By"],
        [
            ["*-django-secret-key", "Django SECRET_KEY", "API, Worker"],
            ["*-db-password", "Cloud SQL database password", "API, Worker"],
            ["*-redis-auth", "Memorystore Redis AUTH string", "API, Worker"],
            ["*-jwt-signing-key", "JWT token signing key", "API, Worker"],
            ["*-anthropic-api-key", "Anthropic API key for AI features", "API, Worker"],
            ["*-email-host-password", "SMTP email password", "API, Worker"],
            ["*-ldap-bind-password", "LDAP bind password", "API, Worker"],
            ["*-azure-client-secret", "Azure AD client secret", "API, Worker"],
        ],
        col_widths=[W * 0.28, W * 0.42, W * 0.30],
    ))

    story.append(Paragraph("9.4 Cloud Run Services", s['SubSection']))
    story.append(make_table(
        ["Service", "Staging", "Production"],
        [
            ["API", "{project}-staging-api", "{project}-production-api"],
            ["Celery Worker", "{project}-staging-worker", "{project}-production-worker"],
            ["Migration Job", "{project}-staging-api-migrate", "{project}-production-api-migrate"],
        ],
        col_widths=[W * 0.18, W * 0.38, W * 0.44],
    ))

    story.append(Paragraph("9.5 Container Images", s['SubSection']))
    story.append(make_table(
        ["Image", "Dockerfile", "Entrypoint"],
        [
            ["backend", "HRMS/backend/Dockerfile", "Gunicorn on port 8080"],
            ["celery-worker", "HRMS/backend/Dockerfile.celery", "Celery: 4 queues, concurrency 4"],
        ],
        col_widths=[W * 0.18, W * 0.35, W * 0.47],
    ))

    story.append(Paragraph("9.6 Network Architecture", s['SubSection']))
    story.extend(code_block([
        "VPC: 10.0.0.0/20",
        "  Subnet: Primary range",
        "  Secondary ranges (reserved for future GKE):",
        "    Pods:     10.4.0.0/14",
        "    Services: 10.8.0.0/20",
        "  Serverless VPC Connector: 10.1.0.0/28",
        "",
        "Cloud SQL:  Private IP (via VPC peering)",
        "Redis:      Private IP (via VPC peering)",
        "Cloud Run:  Connects via Serverless VPC Connector",
        "            (PRIVATE_RANGES_ONLY egress)",
    ]))

    story.append(Paragraph("9.7 Staging vs Production Differences", s['SubSection']))
    story.append(make_table(
        ["Setting", "Staging", "Production"],
        [
            ["DB Availability", "ZONAL", "REGIONAL (HA)"],
            ["Redis Tier", "BASIC", "STANDARD_HA"],
            ["Cloud Armor", "Basic (SQLi, XSS, rate limit)", "Full OWASP + bot blocking"],
            ["Min API Instances", "0 (scale to zero)", "1 (always warm)"],
            ["Min Worker Instances", "0 (scale to zero)", "1 (always warm)"],
            ["Deletion Protection", "Disabled", "Enabled"],
            ["Point-in-time Recovery", "Disabled", "Enabled"],
            ["Backup Retention", "7 days", "30 days"],
        ],
        col_widths=[W * 0.25, W * 0.35, W * 0.40],
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  10. MONITORING & ALERTING
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("10. Monitoring &amp; Alerting", s['SectionTitle']))

    story.append(Paragraph("10.1 Alert Policies (16 per environment)", s['SubSection']))
    story.append(Paragraph("<b>Critical Alerts (Email + Slack):</b>", s['Body']))
    story.append(make_table(
        ["Alert", "Condition", "Duration"],
        [
            ["API Liveness failure", "Uptime check down", "5 min"],
            ["API Latency > 8s p95", "Sustained high latency", "5 min"],
            ["API Error Rate > 5%", "High 5xx error rate", "5 min"],
            ["Cloud SQL CPU > 90%", "Database CPU saturation", "5 min"],
            ["Cloud SQL Memory > 92%", "Database memory pressure", "5 min"],
            ["Cloud SQL Disk > 90%", "Database disk near full", "5 min"],
            ["Redis Memory > 85%", "Cache memory pressure", "5 min"],
            ["App Error Spike > 50", "Burst of application errors", "5 min"],
        ],
        col_widths=[W * 0.30, W * 0.45, W * 0.15],
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Warning Alerts (Email only):</b>", s['Body']))
    story.append(make_table(
        ["Alert", "Condition", "Duration"],
        [
            ["API Readiness failure", "Heavy check down", "10 min"],
            ["API Latency > 3s p95", "Elevated latency", "5 min"],
            ["API Error Rate > 2%", "Elevated error rate", "5 min"],
            ["Cloud SQL CPU > 70%", "Database CPU elevated", "5 min"],
            ["Cloud SQL Memory > 80%", "Database memory elevated", "5 min"],
            ["Cloud SQL Disk > 75%", "Database disk growing", "5 min"],
            ["Redis Memory > 70%", "Cache memory elevated", "5 min"],
            ["Worker at Max Scale", "All worker slots consumed", "10 min"],
        ],
        col_widths=[W * 0.30, W * 0.45, W * 0.15],
    ))

    story.append(Paragraph("10.2 Custom Dashboard (12 widgets)", s['SubSection']))
    story.append(Paragraph(
        "A Terraform-managed dashboard is created automatically with the following widgets:",
        s['Body']
    ))
    dashboard_items = [
        "API Request Latency (p50/p95/p99)",
        "API Request Count by Status Code",
        "API Instance Count",
        "Cloud SQL CPU Utilization",
        "Cloud SQL Memory Utilization",
        "Cloud SQL Active Connections",
        "Cloud SQL Disk Utilization",
        "Redis Memory Usage",
        "Redis Cache Hit Ratio",
        "Worker Instance Count",
        "Application Errors (log-based)",
        "Celery Task Failures (log-based)",
    ]
    for item in dashboard_items:
        story.append(bullet(item))

    story.append(Paragraph("10.3 Log-Based Metrics", s['SubSection']))
    story.append(make_table(
        ["Metric", "Source Filter", "Type"],
        [
            ["*_app_errors", 'jsonPayload.level="ERROR"', "DELTA / INT64"],
            ["*_slow_queries", 'jsonPayload.event="slow_query"', "DISTRIBUTION"],
            ["*_task_failures", 'jsonPayload.event="task_failure"', "DELTA / INT64"],
            ["*_http_request_latency", 'jsonPayload.event="http_request"', "DISTRIBUTION"],
        ],
        col_widths=[W * 0.28, W * 0.42, W * 0.30],
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  11. TROUBLESHOOTING
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("11. Troubleshooting", s['SectionTitle']))
    story.append(Paragraph(
        "Common issues encountered during first deployment and their resolutions.",
        s['Body']
    ))

    issues = [
        ("Terraform: '409 Conflict' creating Cloud SQL",
         "Cloud SQL instance names are globally unique and cannot be reused for 7 days after deletion. "
         "Change the name_prefix in your tfvars or wait 7 days."),
        ("Cloud Run: 'Image not found'",
         "Terraform tried to create the Cloud Run service before images exist. Push initial images "
         "(step 3.4), then re-run make apply."),
        ("Cloud Run: 'Container failed to start'",
         "Check logs with: gcloud run services logs read SERVICE --region=REGION --limit=50. "
         "Common causes: missing secrets, VPC connector issue, database unreachable."),
        ("SSL certificate stuck in PROVISIONING",
         "Verify DNS records resolve correctly. Check for CAA records blocking Google's CA (pki.goog). "
         "Wait up to 24 hours. Ensure domain in ssl_certificate_domains matches DNS record exactly."),
        ("'Permission denied' errors",
         "Verify service account roles: gcloud projects get-iam-policy $PROJECT_ID "
         "--flatten='bindings[].members' --filter='bindings.members:serviceAccount:*api-sa*'"),
        ("Database connection refused from Cloud Run",
         "Verify VPC connector is healthy, private services access is configured, "
         "and Cloud SQL instance has a private IP."),
        ("Redis connection timeout",
         "Verify Memorystore instance is in the same VPC, Redis AUTH password matches Secret Manager, "
         "and VPC connector egress is PRIVATE_RANGES_ONLY."),
        ("Frontend returns 403 Forbidden",
         "Verify bucket-level public access is enabled, allUsers has roles/storage.objectViewer, "
         "and index.html exists in the bucket root."),
        ("Celery worker not processing tasks",
         "Check worker logs, verify Redis connectivity (Celery broker), "
         "and confirm the worker is running queues: default,imports,reports,payroll."),
    ]
    for i, (title, desc) in enumerate(issues, 1):
        story.append(Paragraph(f"<b>{i}. {title}</b>", s['Body']))
        story.append(Paragraph(desc, s['Body']))
        story.append(Spacer(1, 4))

    story.append(Paragraph("Useful Debugging Commands", s['SubSubSection']))
    story.extend(code_block([
        "# View Cloud Run service status",
        "gcloud run services describe SERVICE --region=REGION --project=PROJECT_ID",
        "",
        "# Stream logs in real time",
        "gcloud run services logs tail SERVICE --region=REGION --project=PROJECT_ID",
        "",
        "# View Cloud SQL instance",
        "gcloud sql instances describe INSTANCE --project=PROJECT_ID",
        "",
        "# View Redis instance",
        "gcloud redis instances describe INSTANCE --region=REGION --project=PROJECT_ID",
        "",
        "# Check Terraform state",
        "cd infra && make state-list ENV=staging",
    ]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    #  12. POST-DEPLOYMENT CHECKLIST
    # ════════════════════════════════════════════════════════════
    story.append(Paragraph("12. Post-Deployment Checklist", s['SectionTitle']))
    story.append(Paragraph(
        "After completing the first deployment, verify every item below passes.",
        s['Body']
    ))

    checklist = [
        ("API Health", "API responds at /healthz/ with HTTP 200"),
        ("API Readiness", "API responds at /readyz/ with HTTP 200 (database + Redis connected)"),
        ("Frontend", "Frontend loads at the custom domain"),
        ("SSL", "SSL certificate is ACTIVE (not PROVISIONING)"),
        ("Auth", "Admin can log in to the Django admin panel"),
        ("Workers", "Celery worker is processing tasks"),
        ("Monitoring", "Monitoring dashboard shows data"),
        ("Uptime", "Uptime checks are passing in Cloud Monitoring"),
        ("Alerts", "Alert notification channels are verified (email + Slack)"),
        ("Maintenance", "Scheduled maintenance workflow is enabled in GitHub Actions"),
        ("WIF", "GitHub Actions can authenticate via Workload Identity Federation"),
        ("Seed Data", "Seed data loaded (roles, permissions, tax brackets, bank codes)"),
        ("Backups", "Database backups are running (check Cloud SQL backup schedule)"),
        ("CDN", "CDN is serving cached assets (check x-cache header in dev tools)"),
        ("WAF", "Cloud Armor WAF is blocking test SQL injection attempts"),
    ]
    story.append(make_table(
        ["#", "Check", "Description"],
        [[str(i), check, desc] for i, (check, desc) in enumerate(checklist, 1)],
        col_widths=[W * 0.05, W * 0.18, W * 0.77],
    ))
    story.append(Spacer(1, 20))
    story.append(hr())
    story.append(Paragraph(
        "<i>This document is maintained by the DevOps &amp; Infrastructure Team. "
        "Replace all {project}, {domain}, and {org} placeholders with your client-specific values.</i>",
        s['Body']
    ))

    # Build
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF generated: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    build_pdf()
