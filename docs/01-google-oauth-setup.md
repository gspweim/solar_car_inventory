# Google OAuth Setup

## Overview
The app uses Google Sign-In (OAuth 2.0) for authentication. Users sign in with their Google account; the backend verifies the ID token and issues a JWT.

---

## Step 1: Create a Google Cloud Project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it `calsol-inventory` → **Create**

---

## Step 2: Enable the Google Identity API

1. In the left menu: **APIs & Services → Library**
2. Search for **"Google Identity"** → Enable it

---

## Step 3: Configure the OAuth Consent Screen

1. **APIs & Services → OAuth consent screen**
2. User Type: **External** → **Create**
3. Fill in:
   - App name: `CalSol Inventory`
   - User support email: your email
   - Developer contact: your email
4. **Scopes**: Add `email`, `profile`, `openid`
5. **Test users**: Add your team's emails while in development
6. Save and continue

---

## Step 4: Create OAuth 2.0 Credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `CalSol Inventory Web`
4. **Authorized JavaScript origins**:
   - `http://localhost:3000` (for local dev)
   - `https://inventory.calsol.org` (production)
5. **Authorized redirect URIs**: (not needed for the credential/one-tap flow)
6. Click **Create**
7. Copy the **Client ID** — you'll need it in two places:
   - AWS SAM parameter: `GoogleClientId`
   - Frontend env var: `REACT_APP_GOOGLE_CLIENT_ID`

---

## Step 5: Publish the App (when ready for all users)

1. **OAuth consent screen → Publishing status → Publish App**
2. This removes the "unverified app" warning for non-test users

---

## Notes
- The backend verifies tokens by calling `https://oauth2.googleapis.com/tokeninfo?id_token=<token>`
- The first user to log in is automatically made **admin**
- Subsequent users are **readonly** until an admin promotes them
