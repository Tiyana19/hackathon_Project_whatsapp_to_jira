**Challenge: From WhatsApp Chats to Structured Project Tasks**
==============================================================

### **Background**

Teams often receive **unstructured, fragmented client requirements over WhatsApp**—ranging from voice notes to quick texts and media files. These informal requests are critical but often:

*   Get lost in long chat threads.
    
*   Require manual transcription/structuring.
    
*   Lead to errors, delays, and misalignment in execution.
    

Currently, there’s **no seamless way** to translate WhatsApp conversations into structured work items in project management systems like **Jira**.

### **The Challenge**

Design and prototype a system that:

1.  **Captures WhatsApp messages** (text, images, voice-to-text).
    
2.  **Uses NLP/LLMs** to parse messages into structured **task drafts** (title, description, priority, tags, attachments).
    
3.  **Provides a review layer** where the team can edit/approve suggestions.
    
4.  **Auto-creates Jira tickets via API** once approved.
    

The goal is to turn messy, informal WhatsApp chats into **clean, actionable Jira tasks**—with **minimal manual effort, fewer errors, and faster execution.**

### **Objectives**

*   **Message Ingestion**
    
    *   Capture incoming WhatsApp messages (via Twilio, WhatsApp Business API, or mock data).
        
    *   Support text, attachments (images, docs), and voice (converted to text).
        
*   **Task Structuring**
    
    *   Parse message content into **draft task fields**:
        
        *   Title
            
        *   Description
            
        *   Priority (High/Medium/Low)
            
        *   Tags/Labels
            
        *   Attachments
            
    *   Handle fragmented inputs spread across multiple messages.
        
*   **Human-in-the-loop Review**
    
    *   Display AI-generated task drafts in a review dashboard.
        
    *   Allow quick edits (inline edit, approve, reject).
        
*   **Jira Integration**
    
    *   On approval, auto-create Jira tickets via REST API.
        
    *   Maintain mapping between WhatsApp thread ↔ Jira ticket for traceability.
        

### **Expected Output**

*   A **working prototype** showing:
    
    *   WhatsApp input → captured (or simulated).
        
    *   LLM-generated draft Jira task.
        
    *   Review/edit step by a human.
        
    *   Jira ticket creation via API.
        
*   **Documentation** explaining:
    
    *   NLP/LLM parsing approach.
        
    *   Jira API integration flow.
        
    *   Limitations and roadmap (multi-client handling, multilingual, deduplication).
        

### **Example Flow**

1.  Client sends:
    
    *   “Hey, can you redesign the checkout page? Payments fail sometimes.”
        
    *   Followed by: “Also make sure it works on mobile.”
        
    *   Attach a screenshot of the error.
        
2.  System parses into draft task:
    
    *   **Title:** Redesign Checkout Page for Mobile & Payment Issues
        
    *   **Description:** Client reported payment failures on checkout. Needs redesign for mobile responsiveness. Screenshot attached.
        
    *   **Priority:** High
        
    *   **Tags:** \[checkout\], \[payments\], \[mobile\]
        
3.  Team reviews, approves, → Jira ticket created automatically.
    

### **Evaluation Criteria**

*   **Accuracy (30%)** – How well are WhatsApp messages parsed into structured tasks?
    
*   **Usability (25%)** – Is the review & approval flow intuitive and minimal-effort?
    
*   **Integration (20%)** – Smoothness of Jira API interaction, traceability.
    
*   **Scalability (15%)** – Can it handle multiple chats, attachments, and projects?
    
*   **Innovation (10%)** – Features like deduplication, priority prediction, multilingual support.




