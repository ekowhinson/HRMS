# DNS Records for NHIA HRMS System (GCP Deployment)

**Domain:** `hrms.nhia.gov.gh`
**Infrastructure:** Google Cloud Platform (Cloud Run, Cloud CDN, Global Load Balancer)
**SSL:** Google-managed certificates

---

## Required DNS Records

### A Records

| Host                      | Type | Value                                                        | TTL  | Purpose                          |
|---------------------------|------|--------------------------------------------------------------|------|----------------------------------|
| `hrms.nhia.gov.gh`       | A    | `[Load Balancer IP]` (from `terraform output cdn_ip_address`) | 300  | Frontend (GCS + Cloud CDN + GLB) |
| `api.hrms.nhia.gov.gh`   | A    | `[Load Balancer IP]` (same LB IP or Cloud Run mapped domain)  | 300  | API (GCP Cloud Run)              |

> **How to get the Load Balancer IP:**
> ```bash
> terraform output cdn_ip_address
> ```
> This returns the static global IP address reserved for the Global Load Balancer.

### CNAME Records

| Host                          | Type  | Value                  | TTL  | Purpose                     |
|-------------------------------|-------|------------------------|------|-----------------------------|
| `www.hrms.nhia.gov.gh`       | CNAME | `hrms.nhia.gov.gh`    | 3600 | Redirect www to apex domain |

### TXT Records

| Host                            | Type | Value                                                          | TTL  | Purpose              |
|---------------------------------|------|----------------------------------------------------------------|------|-----------------------|
| `hrms.nhia.gov.gh`             | TXT  | `v=spf1 include:_spf.google.com ~all`                         | 3600 | SPF (email sending)  |
| `_dmarc.hrms.nhia.gov.gh`     | TXT  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@nhia.gov.gh`        | 3600 | DMARC policy         |

### CAA Records

| Host                      | Type | Value                      | TTL  | Purpose                                    |
|---------------------------|------|----------------------------|------|--------------------------------------------|
| `hrms.nhia.gov.gh`       | CAA  | `0 issue "pki.goog"`      | 3600 | Restrict certificate issuance to Google Trust Services |

---

## SSL Certificate Validation

Google-managed SSL certificates validate domain ownership automatically via DNS. No manual DNS challenge records are required once the A records point to the Load Balancer IP.

**Certificate coverage:**
- `hrms.nhia.gov.gh`
- `www.hrms.nhia.gov.gh`
- `api.hrms.nhia.gov.gh`

**Certificate provisioning notes:**
- Google-managed certificates are provisioned automatically when DNS records are correctly configured.
- Initial provisioning can take 15-60 minutes after DNS propagation.
- Certificates auto-renew before expiry (no manual intervention required).

---

## HTTP-to-HTTPS Redirect

The Global Load Balancer is configured with an HTTP-to-HTTPS redirect rule. All traffic on port 80 is automatically redirected to port 443 with a 301 status code. No additional DNS configuration is required for this; it is handled at the load balancer layer.

---

## Staging Environment

The staging environment follows the same DNS pattern with the `staging` subdomain prefix.

### Staging A Records

| Host                              | Type | Value                                                                   | TTL  | Purpose           |
|-----------------------------------|------|-------------------------------------------------------------------------|------|--------------------|
| `staging.hrms.nhia.gov.gh`       | A    | `[Staging LB IP]` (from `terraform output cdn_ip_address` in staging)   | 300  | Staging frontend   |
| `api.staging.hrms.nhia.gov.gh`   | A    | `[Staging LB IP]` (same staging LB IP or Cloud Run mapped domain)       | 300  | Staging API        |

### Staging CNAME Records

| Host                                  | Type  | Value                          | TTL  | Purpose     |
|---------------------------------------|-------|--------------------------------|------|-------------|
| `www.staging.hrms.nhia.gov.gh`       | CNAME | `staging.hrms.nhia.gov.gh`    | 3600 | www redirect |

### Staging CAA Records

| Host                              | Type | Value                      | TTL  | Purpose                                    |
|-----------------------------------|------|----------------------------|------|--------------------------------------------|
| `staging.hrms.nhia.gov.gh`       | CAA  | `0 issue "pki.goog"`      | 3600 | Restrict certificate issuance to Google Trust Services |

---

## Verification Steps

After configuring DNS records, run the following checks to confirm everything is working.

### 1. Check DNS Propagation

```bash
# Verify A record for frontend
dig hrms.nhia.gov.gh A +short

# Verify A record for API
dig api.hrms.nhia.gov.gh A +short

# Verify CNAME for www
dig www.hrms.nhia.gov.gh CNAME +short

# Verify CAA record
dig hrms.nhia.gov.gh CAA +short

# Verify TXT/SPF record
dig hrms.nhia.gov.gh TXT +short

# Verify DMARC record
dig _dmarc.hrms.nhia.gov.gh TXT +short
```

### 2. Verify SSL Certificate

```bash
# Check SSL handshake and certificate details
curl -vI https://hrms.nhia.gov.gh 2>&1 | grep -E "subject:|expire|issuer:"

# Verify certificate covers all SANs
openssl s_client -connect hrms.nhia.gov.gh:443 -servername hrms.nhia.gov.gh < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"
```

### 3. Verify HTTP-to-HTTPS Redirect

```bash
# Should return 301 redirect to https://
curl -I http://hrms.nhia.gov.gh
```

Expected output includes:
```
HTTP/1.1 301 Moved Permanently
Location: https://hrms.nhia.gov.gh/
```

### 4. Verify API Endpoint

```bash
# Health check endpoint
curl https://api.hrms.nhia.gov.gh/healthz/
```

### 5. Verify Staging Environment

```bash
dig staging.hrms.nhia.gov.gh A +short
curl -I https://staging.hrms.nhia.gov.gh
curl https://api.staging.hrms.nhia.gov.gh/healthz/
```

---

## Monitoring

### Certificate Expiry Monitoring

Google-managed certificates auto-renew, but monitoring should still be in place as a safety net.

- **Alert threshold:** Trigger alert if certificate expiry is within 7 days.
- **Check command:**
  ```bash
  echo | openssl s_client -connect hrms.nhia.gov.gh:443 -servername hrms.nhia.gov.gh 2>/dev/null | openssl x509 -noout -enddate
  ```
- **GCP Console:** Navigate to Network Services > Load Balancing > [your LB] > Frontend configuration to view certificate status.
- **gcloud CLI:**
  ```bash
  gcloud compute ssl-certificates list --project=[PROJECT_ID]
  gcloud compute ssl-certificates describe [CERT_NAME] --project=[PROJECT_ID] --format="value(expireTime)"
  ```

### DNS Health Monitoring

- Use GCP Uptime Checks (Cloud Monitoring) to monitor:
  - `https://hrms.nhia.gov.gh` (frontend availability)
  - `https://api.hrms.nhia.gov.gh/healthz/` (API availability)
- Configure alerting policies to notify the ops team on downtime.

---

## Notes

- **TTL values:** A records use a short TTL (300s / 5 minutes) to allow quick failover. CNAME, TXT, and CAA records use a longer TTL (3600s / 1 hour) since they change infrequently.
- **DNS provider:** These records must be configured by the NHIA IT team (or DNS administrator) at the authoritative DNS provider for `nhia.gov.gh`.
- **Propagation time:** DNS changes can take up to 48 hours to propagate globally, though most resolve within minutes to a few hours.
- **Terraform managed:** The Load Balancer IP is provisioned by Terraform. Do not manually modify GCP networking resources outside of Terraform.
