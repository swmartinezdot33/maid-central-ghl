# Vercel Deployment Guide

This guide will help you deploy the Maid Central → GoHighLevel integration to Vercel using the CLI and ensure it's ready to handle production scale.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm install -g vercel`
3. **Vercel KV Database**: Required for storing credentials and tokens

## Quick Deployment

### 1. Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

This will open a browser window to authenticate.

### 3. Link Your Project

From your project directory:

```bash
vercel link
```

This will:
- Ask if you want to link to an existing project or create a new one
- Set up the `.vercel` directory with project configuration

### 4. Create Vercel KV Database

```bash
vercel kv create
```

This will:
- Create a new KV database
- Return the connection details

**Save these values** - you'll need them for environment variables:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### 5. Set Environment Variables

Set the required environment variables in Vercel:

```bash
# Set KV credentials
vercel env add KV_REST_API_URL
# Paste your KV_REST_API_URL when prompted

vercel env add KV_REST_API_TOKEN
# Paste your KV_REST_API_TOKEN when prompted

# Set Maid Central API base URL (optional, defaults to production)
vercel env add MAID_CENTRAL_API_BASE_URL production
# Enter: https://api.maidcentral.com

# Set app base URL for production
vercel env add APP_BASE_URL production
# Enter your production URL (e.g., https://your-app.vercel.app)
```

Or set them all at once via the Vercel dashboard:
1. Go to your project on vercel.com
2. Navigate to **Settings → Environment Variables**
3. Add each variable for the appropriate environments (Production, Preview, Development)

### 6. Deploy to Production

```bash
vercel --prod
```

This will:
- Build your application
- Deploy to production
- Give you a production URL

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `KV_REST_API_URL` | Yes | Vercel KV REST API URL | `https://your-kv.vercel.app` |
| `KV_REST_API_TOKEN` | Yes | Vercel KV REST API Token | `your-token-here` |
| `MAID_CENTRAL_API_BASE_URL` | No | Maid Central API base URL | `https://api.maidcentral.com` |
| `APP_BASE_URL` | No | Your app's base URL (for webhooks) | `https://your-app.vercel.app` |

## Deployment Configuration

The project includes a `vercel.json` file that configures:

- **Function Timeouts**: 
  - Standard API routes: 30 seconds
  - Webhook handler: 60 seconds (to handle external API calls)
  
- **Automatic Scaling**: Vercel automatically scales serverless functions based on demand

## Post-Deployment Setup

After deployment:

1. **Access your app**: Visit your production URL
2. **Configure Maid Central credentials**: Go to `/setup` page
3. **Configure GoHighLevel token**: Add your private token and location ID
4. **Set up field mappings**: Go to `/mapping` page
5. **Configure webhook**: Copy the webhook URL from the home page and add it to Maid Central

## Monitoring and Scaling

### Vercel Dashboard

Monitor your deployment:
- **Functions**: View serverless function execution logs
- **Analytics**: Track requests, performance, and errors
- **Logs**: Real-time function execution logs

### Scaling Characteristics

This application is designed to scale:

✅ **Serverless Functions**: Each API route runs as an isolated serverless function  
✅ **Stateless Design**: No shared state between requests  
✅ **Vercel KV**: Highly available, globally distributed key-value store  
✅ **Automatic Scaling**: Vercel scales functions automatically based on traffic  
✅ **Timeout Protection**: 30-60 second timeouts prevent runaway functions  
✅ **Error Handling**: Comprehensive error handling with appropriate HTTP status codes  

### Performance Optimizations

- **Parallel API Calls**: Webhook handler fetches data in parallel where possible
- **Efficient KV Operations**: Minimal KV reads/writes per request
- **Connection Pooling**: Axios instances are reused
- **Timeout Configuration**: Prevents hanging requests

### Rate Limiting Considerations

- **Maid Central API**: Check their rate limits and implement retry logic if needed
- **GoHighLevel API**: Check their rate limits
- **Vercel KV**: Free tier has rate limits; Pro tier has higher limits

If you expect high volume:
- Consider upgrading Vercel plan for higher function execution limits
- Implement request queuing for webhook processing if needed
- Add retry logic with exponential backoff

## Testing the Deployment

### 1. Test the Webhook

```bash
curl -X POST https://your-app.vercel.app/api/webhook/quote \
  -H "Content-Type: application/json" \
  -d '{"quoteId": "12345"}'
```

### 2. Check Function Logs

```bash
vercel logs
```

Or view in the Vercel dashboard under **Deployments → [Your Deployment] → Functions**

## Troubleshooting

### Functions Timing Out

If you see timeout errors:
- Check the `vercel.json` configuration for timeout settings
- Review external API response times
- Consider optimizing API calls

### KV Connection Issues

If KV operations fail:
- Verify environment variables are set correctly
- Check KV database status in Vercel dashboard
- Ensure KV is in the same region as your functions

### Build Failures

If deployment fails:
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure TypeScript compilation succeeds locally

## Production Checklist

- [ ] Vercel KV database created and configured
- [ ] All environment variables set in Vercel
- [ ] Application deployed successfully
- [ ] Maid Central credentials configured
- [ ] GoHighLevel token configured
- [ ] Field mappings set up
- [ ] Webhook URL added to Maid Central
- [ ] Test webhook successfully processes a quote
- [ ] Monitoring and logging enabled

## Support

For issues:
- Check Vercel [documentation](https://vercel.com/docs)
- Review function logs: `vercel logs`
- Check Vercel status page: [vercel-status.com](https://www.vercel-status.com)









