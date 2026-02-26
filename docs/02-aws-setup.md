# AWS Setup Guide

## Prerequisites
- AWS account (free tier works for development)
- AWS CLI installed: `brew install awscli`
- AWS SAM CLI installed: `brew install aws-sam-cli`
- Python 3.12 installed
- Node.js 20+ installed

---

## Step 1: Create an IAM User for Deployments

1. Go to **IAM → Users → Create user**
2. Name: `calsol-deploy`
3. **Attach policies directly**:
   - `AWSLambda_FullAccess`
   - `AmazonDynamoDBFullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
4. Create user → **Create access key** → CLI
5. Save the **Access Key ID** and **Secret Access Key**

---

## Step 2: Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: us-east-1
# Default output format: json
```

---

## Step 3: Create an S3 Bucket for SAM Artifacts

SAM needs an S3 bucket to store Lambda deployment packages.

```bash
aws s3 mb s3://calsol-sam-artifacts-<your-account-id> --region us-east-1
```

Add this to `samconfig.toml` (created automatically by `sam deploy --guided`).

---

## Step 4: First Deploy (Guided)

```bash
# From the project root:
bash scripts/build.sh

sam deploy --guided
```

Answer the prompts:
- Stack name: `calsol-inventory-prod`
- Region: `us-east-1`
- GoogleClientId: `<your Google OAuth client ID>`
- JwtSecret: `<generate a random 32+ char string>`
- AllowedOrigin: `https://inventory.calsol.org` (or `*` for dev)
- Environment: `prod`
- Save to samconfig.toml: `Y`

After deploy, note the **ApiUrl** output — this is your `REACT_APP_API_URL`.

---

## Step 5: Create the Frontend S3 Bucket

```bash
# Replace with your desired bucket name
BUCKET=calsol-inventory-frontend

aws s3 mb s3://$BUCKET --region us-east-1

# Enable static website hosting
aws s3 website s3://$BUCKET \
  --index-document index.html \
  --error-document index.html

# Set bucket policy for public read
aws s3api put-bucket-policy --bucket $BUCKET --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'"$BUCKET"'/*"
  }]
}'
```

---

## Step 6: Create a CloudFront Distribution

1. Go to **CloudFront → Create distribution**
2. **Origin domain**: Select your S3 bucket website endpoint
   - Use the **website endpoint** (e.g., `calsol-inventory-frontend.s3-website-us-east-1.amazonaws.com`), NOT the S3 REST endpoint
3. **Viewer protocol policy**: Redirect HTTP to HTTPS
4. **Default root object**: `index.html`
5. **Custom error responses**:
   - Error code: `403` → Response page: `/index.html` → HTTP 200
   - Error code: `404` → Response page: `/index.html` → HTTP 200
   (This enables React Router to work)
6. Create distribution
7. Note the **Distribution ID** and **Domain name** (e.g., `d1234abcd.cloudfront.net`)

---

## Step 7: Set Up Route 53 (Custom Domain)

### If you own calsol.org:

1. **Route 53 → Hosted zones → Create hosted zone**
   - Domain: `calsol.org`
   - Type: Public hosted zone
2. Update your domain registrar's nameservers to the Route 53 NS records

### Create the subdomain record:

1. **Route 53 → Your hosted zone → Create record**
2. Record name: `inventory`
3. Record type: `A`
4. Alias: Yes → CloudFront distribution → select your distribution
5. Create record

### Request an SSL Certificate (ACM):

1. **Certificate Manager → Request certificate**
2. Domain: `inventory.calsol.org`
3. Validation: DNS validation
4. Add the CNAME record to Route 53 (there's a button to do this automatically)
5. Wait for validation (5-30 minutes)
6. Go back to your CloudFront distribution → Edit → Add the certificate

---

## Step 8: Deploy the Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your API URL and Google Client ID

npm install
npm run build

# Deploy to S3
aws s3 sync build/ s3://calsol-inventory-frontend/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp build/index.html s3://calsol-inventory-frontend/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

## Step 9: Set GitHub Secrets (for CI/CD)

In your GitHub repo → **Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `JWT_SECRET` | Random 32+ char string |
| `REACT_APP_API_URL` | API Gateway URL from SAM output |
| `FRONTEND_S3_BUCKET` | Your S3 bucket name |
| `CLOUDFRONT_DIST_ID` | CloudFront distribution ID |

After setting secrets, every push to `main` will auto-deploy.

---

## DynamoDB Tables Created by SAM

The SAM template automatically creates these tables:

| Table | Purpose |
|---|---|
| `calsol-users-prod` | User accounts and roles |
| `calsol-cars-prod` | Car definitions |
| `calsol-parts-prod` | Active parts inventory |
| `calsol-part-history-prod` | Retired/replaced parts log |
| `calsol-miles-log-prod` | Test session miles log |
| `calsol-part-fields-prod` | Custom field definitions |

All tables use **PAY_PER_REQUEST** billing (no capacity planning needed).
