# Metaphortech Inc. - AI Workflow Automation Website

A modern, fully functional website for Metaphortech Inc., featuring AI workflow automation solutions across multiple industries.

## 🚀 Features

### Frontend
- **Modern Design**: Dark theme with cyan accents, inspired by Rolax.com
- **Responsive Layout**: Works perfectly on all devices
- **Smooth Animations**: Scroll animations, hover effects, and transitions
- **Interactive Forms**: Contact form, newsletter signup, and demo requests
- **AI Chatbot**: Intelligent assistant with FAQ support, LLM integration, and quick replies
- **Real-time Notifications**: Success/error messages for user feedback

### Backend
- **Express.js Server**: Fast and scalable Node.js backend
- **SQLite Database**: Lightweight database for storing contacts, subscribers, and analytics
- **Email Integration**: Automatic email notifications for form submissions
- **Security Features**: Rate limiting, CORS, helmet security headers
- **Analytics Tracking**: Page view tracking and user analytics

### Functionality
- ✅ Contact form with email notifications
- ✅ Newsletter subscription system
- ✅ Demo request functionality integrated into contact form
- ✅ AI Chatbot with FAQ support and LLM integration
- ✅ **VAPI AI Agent for inbound calls**
- ✅ **Twilio phone integration**
- ✅ **Call logging and analytics**
- ✅ **Voice-to-text transcription**
- ✅ **Automated demo scheduling via voice**
- ✅ Analytics tracking
- ✅ Admin statistics endpoint
- ✅ Health check endpoint
- ✅ Rate limiting and security
- ✅ Database persistence

## 🛠️ Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Instructions

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your credentials
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # VAPI Configuration (for AI voice agent)
   VAPI_API_KEY=your-vapi-api-key
   VAPI_ASSISTANT_ID=your-vapi-assistant-id
   VAPI_PHONE_NUMBER_ID=your-vapi-phone-number-id
   
   # Twilio Configuration (for phone integration)
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the website**
   - Open your browser and go to: `http://localhost:3000`

## 📧 Email Configuration

To enable email notifications, you need to set up Gmail:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. **Update your .env file** with the generated password

## 🗄️ Database

The application uses SQLite for data storage. The database file (`database.sqlite`) will be created automatically when you first run the server.

### Database Tables
- `contacts` - Contact form submissions (includes demo requests)
- `subscribers` - Newsletter subscribers
- `analytics` - Page view tracking
- `call_logs` - VAPI call logs with transcripts and AI responses

## 🔧 API Endpoints

### Contact Form
- **POST** `/api/contact` - Submit contact form

### Newsletter
- **POST** `/api/newsletter` - Subscribe to newsletter

### Demo Requests
- **POST** `/api/contact` - Submit contact form (includes demo request functionality)

### Analytics
- **POST** `/api/analytics` - Track page views

### VAPI & Twilio Integration
- **POST** `/api/vapi/webhook` - VAPI webhook for call events
- **POST** `/api/vapi/call/start` - Start outbound call via VAPI
- **GET** `/api/vapi/calls` - Get call history from VAPI

### Admin
- **GET** `/api/admin/stats` - Get basic statistics
- **GET** `/api/health` - Health check endpoint (includes integration status)

## 🎨 Customization

### Styling
- All styles are in the `<style>` section of `public/index.html`
- Color scheme: Black background with cyan (#00d4ff) accents
- Font: Inter (Google Fonts)

### Content
- Update company information in the HTML
- Modify services, pricing, and team sections
- Change email addresses in the contact section

### Backend
- Modify server.js for additional API endpoints
- Update email templates in the server code
- Add new database tables as needed

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Deployment Options
- **Heroku**: Connect your GitHub repository
- **Vercel**: Deploy with Vercel CLI
- **DigitalOcean**: Use App Platform
- **AWS**: Deploy to EC2 or Elastic Beanstalk

## 📱 Mobile Responsiveness

The website is fully responsive and optimized for:
- Desktop computers
- Tablets
- Mobile phones
- All modern browsers

## 🔒 Security Features

- **Rate Limiting**: Prevents spam and abuse
- **CORS Protection**: Secure cross-origin requests
- **Helmet Headers**: Security headers for protection
- **Input Validation**: Server-side validation for all forms
- **SQL Injection Protection**: Parameterized queries

## 📊 Analytics

The website tracks:
- Page views
- User interactions
- Form submissions
- Newsletter signups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support or questions:
- Email: info@metaphortech.com
- Create an issue in the repository

## 🎯 Roadmap

Future enhancements:
- [ ] User authentication system
- [ ] Admin dashboard
- [ ] Blog/News section
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] CRM integration
- [ ] Payment processing
- [x] Enhanced chatbot with AI integration
- [ ] Voice chat support

---

**Built with ❤️ for Metaphortech Inc.** 