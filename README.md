# 🏛️ Claim Manager

A comprehensive legal case management application designed for managing claims, evidence, collaboration, and case workflows. Built with React, TypeScript, and Supabase.

## 🌟 Overview

Claim Manager is a powerful, feature-rich application that helps legal professionals and teams manage their cases efficiently. It provides tools for evidence management, task tracking, calendar integration, real-time collaboration, and secure sharing capabilities.

## ✨ Key Features

### 🏠 **Core Management**
- **Claims Management**: Create, edit, and organize legal claims with detailed case information
- **Evidence Management**: Upload, categorize, and manage evidence with PDF viewing capabilities
- **Task Management**: Create and track to-do items with priorities, due dates, and assignments
- **Calendar Integration**: Schedule events and deadlines with Google Calendar sync
- **Document Export**: Export data in PDF and CSV formats

### 🤝 **Collaboration & Sharing**
- **Secure Claim Sharing**: Share claims with collaborators while maintaining ownership control
- **Real-time Chat**: Integrated messaging system for team communication
- **Video Conferencing**: Built-in video calls using Daily.co integration
- **Guest Access Control**: Granular permissions for shared claims
- **Collaboration Hub**: Centralized workspace for team coordination

### 🔐 **Security & Access Control**
- **Row Level Security (RLS)**: Database-level security policies
- **Ownership Verification**: Only claim owners can share and manage their claims
- **Guest Permissions**: Controlled access for collaborators
- **Authentication**: Secure user authentication with Supabase Auth

### 💰 **Monetization & Subscriptions**
- **Donation-based Model**: Support app development with tiered donations
- **Guest Access Tiers**: 
  - Free: 1 guest total
  - Basic Donation (£5): 2 guests total
  - Premium Donation (£12): 5 guests total
  - Unlimited Donation (£22): Unlimited guests + full app rights + source code
- **Stripe Integration**: Secure payment processing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account (for payments)
- Daily.co account (for video conferencing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Claim-Manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env-template.txt .env
   ```
   
   Fill in your environment variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_DAILY_API_KEY=your_daily_api_key
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
   ```

4. **Database Setup**
   ```bash
   npx supabase db push
   ```

5. **Start Development Server**
   ```bash
npm run dev
```

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **React Query** for data fetching and caching
- **React Hook Form** for form management

### Backend Stack
- **Supabase** for database and authentication
- **PostgreSQL** with Row Level Security
- **Supabase Edge Functions** for serverless functions
- **Stripe** for payment processing
- **Daily.co** for video conferencing

### Key Components

#### 📋 **Claims Management**
- `ClaimsTable.tsx` - Main claims listing and management
- `EditableClaimInfo.tsx` - Claim editing interface
- `ClaimEvidenceManager.tsx` - Evidence management for specific claims

#### 📁 **Evidence System**
- `EvidenceManager.tsx` - Core evidence management
- `AddEvidenceModal.tsx` - Evidence creation interface
- `EvidenceTable.tsx` - Evidence listing and display
- `PDFViewer.tsx` - PDF document viewing
- `PendingEvidenceReview.tsx` - Evidence review workflow

#### 📅 **Calendar & Tasks**
- `Calendar.tsx` - Calendar view with event management
- `TodoList.tsx` - Task management system
- `InHouseCalendar.tsx` - Custom calendar component

#### 🤝 **Collaboration**
- `SharedClaims.tsx` - Shared claims management
- `CollaborationHub.tsx` - Central collaboration interface
- `ChatWindow.tsx` - Real-time messaging
- `VideoConference.tsx` - Video calling integration

#### 💰 **Monetization**
- `SubscriptionManager.tsx` - Donation tiers and payment
- `PaymentModal.tsx` - Payment processing interface

## 🔧 Configuration

### Database Schema
The application uses a comprehensive PostgreSQL schema with the following key tables:
- `claims` - Legal case information
- `evidence` - Evidence items and metadata
- `claim_shares` - Sharing relationships between users
- `todos` - Task management
- `calendar_events` - Calendar events
- `chat_messages` - Real-time messaging
- `subscribers` - User subscription information

### Security Policies
- Row Level Security (RLS) enabled on all tables
- Ownership-based access control
- Guest permission management
- Secure sharing mechanisms

## 🎯 Usage Guide

### Private vs Shared Claims

- **Private Claims**
  - Visible only to the claim owner
  - Full control over claim data, evidence, tasks, and calendar
  - Private To-Dos and Calendar are user-only and not visible to collaborators
  - Best for drafting, preparation, and personal workflows

- **Shared Claims**
  - Shared with specific collaborators via secure invitations
  - Ownership is retained by the host; guests cannot re-share claims
  - Shared To-Dos and Calendar are scoped to the selected shared claim
  - Collaboration Hub is enabled (Chat, Video, Whiteboard)
  - Export in shared context only includes the selected shared claim’s data

### Private vs Shared To‑Dos and Calendar

- **Private To‑Dos**
  - Personal tasks not tied to sharing
  - Only the owner can view/manage
  - Ideal for owner’s own reminders and work items

- **Shared To‑Dos** (per shared claim)
  - Visible to all collaborators on that claim (subject to permissions)
  - Can assign tasks using `responsible_user_id`
  - Appears only when a shared claim is selected

- **Private Calendar**
  - Owner’s personal schedule
  - Not visible to collaborators

- **Shared Calendar** (per shared claim)
  - Events scoped to the selected shared claim
  - Can assign events using `responsible_user_id`
  - Displays to all collaborators with access

### Creating a Claim
1. Navigate to the main dashboard
2. Click "Add New Claim"
3. Fill in case details (case number, title, court, parties)
4. Set claim color and status
5. Save to create the claim

### Managing Evidence
1. Select a claim from the claims list
2. Navigate to the Evidence tab
3. Upload documents or add evidence items
4. Categorize and organize evidence
5. Link evidence to specific claims

### Sharing Claims
1. Select the claim you want to share
2. Click "Share Claim" button
3. Enter collaborator's email address
4. Set permissions (view/edit evidence, etc.)
5. Send invitation

### Collaboration
1. Access shared claims from the "Shared" tab
2. Use the Collaboration Hub for team communication
3. Start video calls for real-time discussion
4. Manage tasks and calendar events together

### Video Conferencing (Daily.co)

- Integrated into the Collaboration Hub under the “Video Conference” tab
- Rooms are auto‑named per claim: `claim-{claim-id}`
- Share the room link to invite collaborators
- Free tier note: While the system supports multiple participants, Daily.co’s free plan effectively allows reliable 1‑to‑1 calls for up to 2 hours per day total usage. For multi‑party or longer sessions, consider upgrading your Daily.co plan.

## 🔒 Security Features

### Access Control
- **Ownership Verification**: Only claim owners can share their claims
- **Guest Permissions**: Granular control over what guests can access
- **Database Security**: RLS policies prevent unauthorized access
- **Frontend Validation**: UI-level security checks

### Data Protection
- **Encrypted Storage**: All data stored securely in Supabase
- **Secure Authentication**: Supabase Auth with email verification
- **Payment Security**: Stripe handles all payment processing
- **API Security**: Edge Functions with proper authentication

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Environment Variables
Ensure all production environment variables are set:
- Supabase production URL and keys
- Stripe production keys
- Daily.co production API key

### Database Migration
```bash
npx supabase db push
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the FAQ section in the app
- Review the documentation
- Open an issue on GitHub

## 🔮 Roadmap

### Planned Features
- [ ] Advanced search and filtering
- [ ] Mobile app development
- [ ] Advanced reporting and analytics
- [ ] Integration with more calendar providers
- [ ] Advanced document processing
- [ ] Workflow automation
- [ ] API for third-party integrations

## 🏆 Acknowledgments

- Built with React and TypeScript
- Powered by Supabase
- Styled with Tailwind CSS
- UI components from Radix UI
- Video conferencing by Daily.co
- Payments processed by Stripe

---

**Claim Manager** - Streamlining legal case management with modern technology and secure collaboration tools.