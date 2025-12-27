# Maid Central → GoHighLevel Integration

This Next.js application integrates Maid Central with GoHighLevel, automatically syncing new quotes from Maid Central to GoHighLevel contacts based on configurable field mappings.

## Features

- **OAuth Marketplace App**: Secure OAuth authentication per GHL location (marketplace app)
- **User Context Support**: Automatic user and location context when embedded in GHL iframe
- **Maid Central API Authentication**: Token-based authentication with automatic token refresh
- **Field Mapping Interface**: Visual interface to map Maid Central quote fields to GoHighLevel contact fields
- **Webhook Support**: Receives webhooks from Maid Central when new quotes are created
- **Bidirectional Appointment Sync**: Syncs appointments between MaidCentral and GHL calendars
- **Multi-tenant Support**: Each GHL location has isolated configuration and credentials
- **Real-time Sync**: Automatically syncs new quotes to GoHighLevel based on configured mappings

## Prerequisites

- Node.js 18+ and npm
- Vercel account with KV storage enabled
- Maid Central account with API access
- GoHighLevel account
- GoHighLevel OAuth app credentials (client ID and secret)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Vercel KV Storage
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token

# Maid Central API
MAID_CENTRAL_API_BASE_URL=https://api.maidcentral.com

# GoHighLevel Private Token (no longer needed - configured via UI)
# GHL_CLIENT_ID=your_ghl_client_id
# GHL_CLIENT_SECRET=your_ghl_client_secret
# GHL_REDIRECT_URI=http://localhost:3001/api/auth/oauth/callback

# App Base URL (for webhooks and OAuth redirects)
APP_BASE_URL=http://localhost:3000
```

### 3. Get Vercel KV Credentials

1. Go to your Vercel dashboard
2. Navigate to your project → Storage → Create Database → KV
3. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### 4. Set Up GHL Marketplace App (OAuth)

1. **Register Your App in GHL Marketplace**
   - Go to: https://marketplace.gohighlevel.com/developer
   - Create a new app
   - Set Redirect URI: `https://maidcentral.vercel.app/api/auth/oauth/callback`
   - Select required scopes: `locations.read`, `contacts.read`, `contacts.write`, `calendars.read`, `calendars.write`
   - Save your **Client ID** and **Client Secret**

2. **Configure Environment Variables**
   - Add `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` to your `.env.local`
   - See `MARKETPLACE_SETUP.md` for detailed instructions

3. **Install the App**
   - Visit `/setup` page in your app
   - Click "Install via OAuth"
   - Complete the OAuth flow to install for your location

### 5. Get Maid Central API Credentials

1. Log into Maid Central
2. Navigate to: **Company → Settings → General → Integrations Tab → API Users**
3. Create a new API user if needed
4. Copy the username and password

### 6. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### Initial Setup

1. **Configure Maid Central Credentials**
   - Go to `/setup` page
   - Enter your Maid Central API username and password
   - Click "Save Credentials"

2. **Install GoHighLevel App (OAuth)**
   - On the `/setup` page
   - Click "Install via OAuth" button
   - Select your GHL location
   - Authorize the app
   - Installation completes automatically

3. **Configure Field Mappings**
   - Go to `/mapping` page
   - Click "Add Mapping" to create field mappings
   - Select a Maid Central field from the dropdown
   - Select the corresponding GoHighLevel field
   - Repeat for all fields you want to sync
   - Click "Save Mappings"

4. **Enable Integration**
   - On the `/mapping` page, toggle the "Integration Toggle" switch to enable

### Webhook Configuration

1. Copy the webhook URL from the home page:
   ```
   https://your-domain.com/api/webhook/quote
   ```

2. Configure this URL in Maid Central to send webhook notifications when new quotes are created

3. The webhook should send a POST request with the quote data, including at minimum a `quoteId` field:
   ```json
   {
     "quoteId": "12345",
     "id": "12345",
     "quote_id": "12345"
   }
   ```

### Testing the Integration

You can test the webhook manually using curl:

```bash
curl -X POST http://localhost:3000/api/webhook/quote \
  -H "Content-Type: application/json" \
  -d '{"quoteId": "12345"}'
```

Or using GET:

```bash
curl "http://localhost:3000/api/webhook/quote?quoteId=12345"
```

## API Routes

- `GET /api/auth/oauth/authorize` - Initiate OAuth installation flow
- `GET /api/auth/oauth/callback` - OAuth callback handler
- `GET /api/auth/oauth/status` - Check OAuth installation status
- `POST /api/maid-central/credentials` - Save Maid Central API credentials
- `GET /api/maid-central/credentials` - Get Maid Central credentials status
- `GET /api/maid-central/fields` - Get available Maid Central quote fields
- `GET /api/ghl/locations` - Get GoHighLevel locations/subaccounts
- `GET /api/ghl/fields` - Get available GoHighLevel contact fields
- `POST /api/mappings` - Save field mappings
- `GET /api/mappings` - Get current field mappings
- `POST /api/webhook/quote` - Webhook endpoint for new quotes
- `GET /api/config` - Get integration configuration
- `PATCH /api/config` - Update integration configuration

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # OAuth routes
│   │   ├── maid-central/ # Maid Central API routes
│   │   ├── ghl/          # GoHighLevel API routes
│   │   ├── mappings/     # Field mapping routes
│   │   ├── webhook/      # Webhook handler
│   │   └── config/       # Configuration routes
│   ├── setup/            # Setup page
│   ├── mapping/          # Field mapping page
│   ├── page.tsx          # Home page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/
│   ├── kv.ts             # Vercel KV storage utilities
│   ├── maid-central.ts   # Maid Central API client
│   └── ghl.ts            # GoHighLevel API client
└── package.json
```

## Deployment to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions using Vercel CLI.

### Quick Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Create KV database
vercel kv create

# Set environment variables
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN

# Deploy to production
vercel --prod
```

**Important**: The application is optimized for serverless/Vercel deployment and handles scale automatically through Vercel's serverless functions.

## Troubleshooting

### OAuth Installation Issues
- Verify `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` are set correctly
- Check that redirect URI matches exactly in GHL Marketplace settings
- Ensure app is accessible via HTTPS (required for OAuth)
- See `MARKETPLACE_SETUP.md` for detailed troubleshooting
- Ensure the Location ID matches your GoHighLevel subaccount
- Check that the token has the necessary permissions for creating contacts

### Webhook Not Processing
- Verify integration is enabled in the `/mapping` page
- Check that field mappings are configured
- Ensure Maid Central credentials are valid
- Check server logs for error messages

### Fields Not Loading
- Ensure Maid Central credentials are saved and valid
- Verify GoHighLevel OAuth is completed
- Check that a location/subaccount is selected

## Security Notes

- Never commit `.env.local` to version control
- Store sensitive credentials only in Vercel KV or environment variables
- Use HTTPS in production
- Regularly rotate API credentials and OAuth tokens

## Support

For Maid Central API documentation: https://support.maidcentral.com/apidocs/

For GoHighLevel API documentation: https://marketplace.gohighlevel.com/docs/

