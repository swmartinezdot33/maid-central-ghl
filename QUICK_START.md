# Quick Start: GHL Marketplace App Setup

## Your Production Domain
**https://maidcentral.vercel.app/**

## Step 1: Register App in GHL Marketplace

1. Go to: https://marketplace.gohighlevel.com/developer
2. Create new app
3. Set **Redirect URI**: `https://maidcentral.vercel.app/api/auth/oauth/callback`
4. Select scopes:
   - `locations.read`
   - `contacts.read` & `contacts.write`
   - `calendars.read` & `calendars.write`
   - `opportunities.read` & `opportunities.write`
5. Save **Client ID** and **Client Secret**

## Step 2: Set Vercel Environment Variables

In your Vercel project settings, add:

```env
GHL_CLIENT_ID=your_client_id_from_ghl
GHL_CLIENT_SECRET=your_client_secret_from_ghl
GHL_REDIRECT_URI=https://maidcentral.vercel.app/api/auth/oauth/callback
APP_BASE_URL=https://maidcentral.vercel.app
DATABASE_URL=your_database_url
```

## Step 3: Install the App

1. Visit: https://maidcentral.vercel.app/setup
2. Click **"Install via OAuth"**
3. Select your GHL location
4. Authorize the app
5. Done! ✅

## Step 4: Configure Integration

1. **MaidCentral Credentials**: Enter API username/password on `/setup`
2. **Field Mappings**: Configure on `/mapping` page
3. **Enable Integration**: Toggle on `/mapping` page
4. **Webhooks**: Point MaidCentral webhooks to:
   - `https://maidcentral.vercel.app/api/webhook/quote`

## Testing

- **Installation URL**: https://maidcentral.vercel.app/api/auth/oauth/authorize
- **Status Check**: https://maidcentral.vercel.app/api/auth/oauth/status?locationId=YOUR_LOCATION_ID

## Troubleshooting

**OAuth not working?**
- Verify `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` are set in Vercel
- Check redirect URI matches exactly: `https://maidcentral.vercel.app/api/auth/oauth/callback`
- Ensure app is deployed and accessible

**No user context?**
- App must be loaded in GHL iframe as marketplace app
- OAuth installation required for user context
- Check browser console for `[GHL Iframe]` logs

