# GHL Marketplace App Setup Guide

This guide will walk you through setting up your MaidCentral → GoHighLevel integration as a GHL Marketplace App with OAuth.

## Prerequisites

- GoHighLevel account with marketplace app developer access
- Your app deployed and accessible via HTTPS (required for OAuth callbacks)
- Environment variables configured

## Step 1: Register Your App in GHL Marketplace

1. **Go to GHL Marketplace Developer Portal**
   - Visit: https://marketplace.gohighlevel.com/developer
   - Or navigate: GHL Dashboard → Marketplace → Developer Portal

2. **Create a New App**
   - Click "Create New App" or "Add App"
   - Fill in app details:
     - **App Name**: MaidCentral Integration (or your preferred name)
     - **Description**: Bidirectional sync between MaidCentral and GoHighLevel
     - **App Icon**: Upload an icon (recommended: 512x512px)
     - **Category**: Choose appropriate category (e.g., "Integrations", "CRM")

3. **Configure OAuth Settings**
   - **Redirect URI**: `https://maidcentral.vercel.app/api/auth/oauth/callback`
     - This is your production callback URL
     - For local testing: `http://localhost:3001/api/auth/oauth/callback`
   - **Scopes**: Select the following scopes:
     - `locations.read` - Read location information
     - `contacts.write` - Create and update contacts
     - `contacts.read` - Read contact information
     - `calendars.read` - Read calendar information
     - `calendars.write` - Create and update calendar appointments
     - `opportunities.write` - Create opportunities (if needed)
     - `opportunities.read` - Read opportunities (if needed)

4. **Save Your Credentials**
   - After creating the app, you'll receive:
     - **Client ID** (e.g., `abc123xyz...`)
     - **Client Secret** (e.g., `secret_abc123...`)
   - **IMPORTANT**: Save these securely - you'll need them for environment variables

## Step 2: Configure Environment Variables

Add these to your `.env.local` file (or your hosting platform's environment variables):

```env
# GoHighLevel OAuth (Marketplace App) - REQUIRED
GHL_CLIENT_ID=your_client_id_from_step_1
GHL_CLIENT_SECRET=your_client_secret_from_step_1
GHL_REDIRECT_URI=https://maidcentral.vercel.app/api/auth/oauth/callback

# App Base URL (for webhooks and OAuth redirects)
APP_BASE_URL=https://maidcentral.vercel.app

# Database (PostgreSQL/Neon)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

**For Local Development:**
```env
GHL_REDIRECT_URI=http://localhost:3001/api/auth/oauth/callback
APP_BASE_URL=http://localhost:3001
```

## Step 3: Deploy Your App

1. **Deploy to Production** (Vercel, Railway, etc.)
   - Make sure your app is accessible via HTTPS
   - Update `APP_BASE_URL` and `GHL_REDIRECT_URI` to your production URL

2. **Update GHL App Redirect URI**
   - Go back to GHL Marketplace Developer Portal
   - Update the Redirect URI to your production URL:
     - `https://maidcentral.vercel.app/api/auth/oauth/callback`

## Step 4: Install the App in GHL

### Option A: Install via GHL Marketplace (Recommended)

1. **Submit Your App for Review** (if required)
   - Some GHL marketplaces require app review before public listing
   - Follow GHL's submission process

2. **Install from Marketplace**
   - Users can find your app in GHL Marketplace
   - Click "Install" on your app
   - GHL will redirect to your OAuth authorization endpoint

### Option B: Install via Direct Link (Development/Testing)

1. **Get Installation URL**
   - Your app's installation URL: `https://maidcentral.vercel.app/api/auth/oauth/authorize`
   - Or with location ID: `https://maidcentral.vercel.app/api/auth/oauth/authorize?locationId=LOCATION_ID`

2. **Access from GHL**
   - In GHL, go to: **Settings → Integrations → Custom Integrations**
   - Add your app URL as a custom integration
   - Or create a custom menu link pointing to your app

3. **Install for Specific Location**
   - Navigate to: `https://maidcentral.vercel.app/setup?locationId=LOCATION_ID`
   - Click "Install via OAuth"
   - Complete the OAuth flow

## Step 5: OAuth Flow

When a user clicks "Install via OAuth":

1. **User is redirected to GHL**
   - URL: `https://marketplace.gohighlevel.com/oauth/chooselocation`
   - User selects which location(s) to install the app for

2. **GHL redirects back with authorization code**
   - Callback URL: `https://maidcentral.vercel.app/api/auth/oauth/callback?code=AUTH_CODE&locationId=LOCATION_ID`

3. **Your app exchanges code for tokens**
   - Backend calls GHL token endpoint
   - Receives `access_token` and `refresh_token`
   - Stores tokens in database per location

4. **User is redirected to success page**
   - URL: `https://maidcentral.vercel.app/setup?success=oauth_installed&locationId=LOCATION_ID`

## Step 6: Verify Installation

1. **Check Installation Status**
   - Visit: `https://maidcentral.vercel.app/setup`
   - Should show "✓ App Installed" with location ID

2. **Test API Access**
   - The app should now be able to make API calls to GHL
   - All API calls will use OAuth tokens automatically

3. **Check User Context**
   - When loaded in GHL iframe, the app will receive user context via `REQUEST_USER_DATA`
   - Location ID and user info will be available automatically

## Troubleshooting

### OAuth Callback Fails

**Error: "redirect_uri_mismatch"**
- Ensure `GHL_REDIRECT_URI` exactly matches what's configured in GHL Marketplace
- Check for trailing slashes, http vs https, etc.

**Error: "invalid_client"**
- Verify `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` are correct
- Check for extra spaces or quotes in environment variables

**Error: "invalid_grant"**
- Authorization code may have expired (codes expire quickly)
- Try the installation flow again

### App Not Receiving User Context

**Issue: No locationId in iframe**
- Ensure app is loaded as a marketplace app (not just custom page)
- Check that OAuth installation completed successfully
- Verify `REQUEST_USER_DATA` postMessage is being sent

**Solution:**
- The app will request user data on load
- If not received, check browser console for errors
- You can manually set locationId: `window.__ghlSetLocationId('LOCATION_ID')`

### Token Expired

**Issue: OAuth token expires**
- GHL tokens may expire after a period
- Currently, token refresh is not implemented (TODO)

**Solution:**
- User needs to reinstall the app via OAuth
- Or implement token refresh using `refresh_token`

## Testing Locally

1. **Use ngrok or similar for HTTPS**
   ```bash
   ngrok http 3001
   ```

2. **Update GHL Redirect URI**
   - Use ngrok URL: `https://your-ngrok-url.ngrok.io/api/auth/oauth/callback`

3. **Update Environment Variables**
   ```env
   GHL_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/auth/oauth/callback
   APP_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

4. **Test OAuth Flow**
   - Visit: `https://your-ngrok-url.ngrok.io/setup`
   - Click "Install via OAuth"
   - Complete the flow

## Next Steps

After successful installation:

1. **Configure MaidCentral Credentials**
   - Go to `/setup` page
   - Enter MaidCentral API username and password

2. **Configure Integration Settings**
   - Go to `/mapping` page
   - Set up field mappings
   - Enable the integration

3. **Set Up Webhooks**
   - Configure MaidCentral webhooks to point to your app
   - Webhook URL: `https://maidcentral.vercel.app/api/webhook/quote`

4. **Test the Integration**
   - Create a quote in MaidCentral
   - Verify it syncs to GHL
   - Check that contacts and opportunities are created

## Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for API errors
3. Verify all environment variables are set correctly
4. Ensure database is accessible and initialized

