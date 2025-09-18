# 🎥 Video Conferencing Setup Guide

## ✅ **Video Conferencing is Now Live!**

Video conferencing has been fully integrated into the Claim Manager collaboration hub. Here's how to set it up and use it.

## 🚀 **Quick Setup**

### 1. **Get Your Daily.co API Key**
1. Go to [https://dashboard.daily.co/](https://dashboard.daily.co/)
2. Create a **free account** (no credit card required)
3. Navigate to **Developers** section
4. Copy your **API key**

### 2. **Configure Environment**
1. Open your `.env` file
2. Add your Daily.co API key:
   ```env
   VITE_DAILY_API_KEY=your_actual_daily_api_key_here
   ```
3. Save the file and restart your development server

### 3. **Test the Integration**
1. Start your app: `npm run dev`
2. Go to a **shared claim**
3. Click **"Show Collaboration"**
4. Click the **"Video Conference"** tab
5. Allow camera/microphone permissions when prompted

## 🎯 **Features Available**

### ✅ **What's Working**
- **🎥 Real-time Video Calls**: HD video with multiple participants
- **🎤 Audio Controls**: Mute/unmute microphone
- **📹 Video Controls**: Turn camera on/off
- **👥 Multi-participant Support**: Up to 2 users on free tier
- **🔗 Room Sharing**: Copy room links to invite others
- **📱 Responsive Design**: Works on desktop and mobile
- **🔄 Auto Room Creation**: Each claim gets its own video room

### 🎨 **User Interface**
- **Video Grid Layout**: Automatically adjusts based on participant count
- **Participant Names**: Shows user names with avatars when video is off
- **Control Bar**: Easy access to video/audio controls
- **Room Information**: Shows room name and participant count
- **Copy Room Link**: One-click sharing functionality

## 🔧 **Technical Details**

### **Room Naming Convention**
- Rooms are named: `claim-{claim-id}`
- Example: `claim-kb2025liv000075`
- Each claim gets its own unique video room

### **Free Tier Limits**
- **2 participants** maximum
- **2 hours** per day
- Perfect for testing and small teams

### **Browser Requirements**
- Chrome, Firefox, Safari, or Edge (latest versions)
- HTTPS required for production
- WebRTC support required

## 🚨 **Troubleshooting**

### **Common Issues**

#### **"Video Conferencing Setup Required"**
- **Cause**: Daily.co API key not configured
- **Solution**: Add `VITE_DAILY_API_KEY` to your `.env` file

#### **"Failed to join video call"**
- **Cause**: Network issues or invalid API key
- **Solution**: Check internet connection and API key

#### **No video/audio**
- **Cause**: Browser permissions not granted
- **Solution**: Allow camera/microphone access when prompted

#### **Room not found**
- **Cause**: Room doesn't exist yet
- **Solution**: Room is created automatically on first join

### **Browser Permissions**
1. Click the camera/microphone icon in your browser's address bar
2. Select "Allow" for both camera and microphone
3. Refresh the page if needed

## 💡 **Usage Tips**

### **For Claim Owners**
1. Select a claim from your claims list
2. Click "Show Collaboration" button
3. Click "Video Conference" tab
4. Share the room link with collaborators

### **For Collaborators**
1. Access the shared claim
2. Click "Show Collaboration" button
3. Click "Video Conference" tab
4. Join the existing room

### **Room Management**
- **Room Links**: Click the copy button to share room links
- **Participant Count**: See how many people are in the call
- **Leave Call**: Click the red phone button to exit

## 🔮 **Future Enhancements**

### **Planned Features**
- **Screen Sharing**: Share your screen during calls
- **Call Recording**: Record important discussions (paid plan)
- **User Management**: Better user identification and profiles
- **Call History**: Track video call sessions
- **Mobile App**: Native mobile video calling

### **Upgrade Options**
- **Pro Plan**: $15/month for 10 users, unlimited time
- **Enterprise**: Custom pricing for larger teams

## 🆘 **Support**

### **Getting Help**
- **Daily.co Documentation**: [https://docs.daily.co/](https://docs.daily.co/)
- **Daily.co Support**: Available through their dashboard
- **App Issues**: Check browser console for error messages

### **Testing Checklist**
- [ ] API key configured in `.env`
- [ ] Browser permissions granted
- [ ] Internet connection stable
- [ ] Multiple participants can join
- [ ] Video/audio controls work
- [ ] Room links can be copied and shared

---

## 🎉 **You're All Set!**

Video conferencing is now fully integrated and ready to use. Start collaborating with your team on shared claims with real-time video calls!

**Need help?** Check the troubleshooting section above or refer to the Daily.co documentation.
