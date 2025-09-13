# Video Conferencing Setup Guide

## Overview
I've integrated Daily.co video conferencing into your Claim Manager collaboration hub. This allows users to have video calls directly within the app when collaborating on shared claims.

## Setup Steps

### 1. Get Daily.co API Key
1. Go to [https://dashboard.daily.co/](https://dashboard.daily.co/)
2. Create a free account (no credit card required)
3. Go to the "Developers" section
4. Copy your API key

### 2. Update Environment Variables
1. Copy `env-template.txt` to `.env` in your project root
2. Replace `your_daily_api_key_here` with your actual Daily.co API key
3. Make sure your Supabase keys are also set correctly

### 3. Test the Integration
1. Start your development server: `npm run dev`
2. Go to a shared claim
3. Click "Show Collaboration"
4. Click the "Video Conference" tab
5. The video call should automatically start

## Features Included

### ✅ What's Working
- **Automatic Room Creation**: Each claim gets its own video room
- **Multi-participant Support**: Multiple users can join the same call
- **Video/Audio Controls**: Toggle camera and microphone on/off
- **Real-time Updates**: See when participants join/leave
- **Responsive Design**: Works on desktop and mobile

### 🔧 Technical Details
- **Room Naming**: Rooms are named `claim-{claim-id}` (e.g., `claim-kb2025liv000075`)
- **User Names**: Random user names for demo (can be customized later)
- **Free Tier**: 2 users, 2 hours per day (perfect for testing)

## Customization Options

### User Names
To show real user names instead of random ones, update the `userName` in `VideoConference.tsx`:
```typescript
userName: `User ${Math.random().toString(36).substr(2, 9)}`, // Replace this
```

### Room Settings
To customize room settings, modify the `join` options in `VideoConference.tsx`:
```typescript
await daily.join({
  url: `https://claim-manager.daily.co/${roomName}`,
  userName: 'Custom User Name',
  startVideoOff: false, // Start with video on
  startAudioOff: false, // Start with audio on
})
```

## Troubleshooting

### Common Issues
1. **"Failed to join call"**: Check your Daily.co API key
2. **No video/audio**: Check browser permissions
3. **Room not found**: The room will be created automatically on first join

### Browser Requirements
- Chrome, Firefox, Safari, or Edge (latest versions)
- HTTPS required for production (works on localhost for development)
- WebRTC support required

## Next Steps

### Potential Enhancements
1. **Screen Sharing**: Add screen sharing capability
2. **Recording**: Enable call recording (requires paid plan)
3. **Chat Integration**: Show video participants in chat
4. **User Management**: Better user identification
5. **Call History**: Track video call sessions

### Scaling Considerations
- **Free Tier**: 2 users, 2 hours/day
- **Pro Plan**: $15/month for 10 users, unlimited time
- **Enterprise**: Custom pricing for larger teams

## Support
- Daily.co Documentation: [https://docs.daily.co/](https://docs.daily.co/)
- Daily.co Support: Available through their dashboard

---

**Note**: The video conferencing is now fully integrated and ready to test! 🎉
