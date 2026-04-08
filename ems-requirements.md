
# 📘 Educational Institution Management System

## Requirements Document (MVP)

## 1. Overview

This system is designed to manage an educational institution, including:

* Classes
* Teachers
* Students
* Payments
* Receipt printing

The system will be web-based, simple, and scalable for future features.

---

## 2. User Roles

### 2.1 Admin

* Full access to all system features
* Manage users and permissions

### 2.2 Staff (Administrative)

* Manage students, teachers, classes
* Register payments

### 2.3 Finance User

* Handle payments
* Print receipts
* View financial reports

---

## 3. Core Modules

---

## 3.1 Student Management

### Features:

* Add/Edit/Delete students
* Unique student ID (auto-generated)

### Student Data:

* Full Name
* Phone Number
* Parent Name
* Parent Phone
* Address
* Enrollment Date
* Notes

---

## 3.2 Teacher Management

### Features:

* Add/Edit/Delete teachers

### Teacher Data:

* Full Name
* Phone Number
* Specialty / Subject
* Salary or Payment Type
* Notes

---

## 3.3 Class Management

### Features:

* Create/Edit/Delete classes
* Assign teacher(s) to class
* Assign students to class

### Class Data:

* Class Name
* Teacher
* Schedule (Days & Time)
* Capacity (optional)
* Notes

---

## 3.4 Attendance (Optional for MVP, Recommended)

* Track student attendance per class
* Simple present/absent system

---

## 3.5 Payment System

### Features:

* Manual payment entry (no payment gateway)
* Track student payments
* Generate receipts

### Payment Data:

* Receipt Number (auto-generated)
* Student Name
* Amount Paid
* Payment Date
* Payment Method (Cash / Other)
* Notes

---

## 3.6 Receipt Printing

### Features:

* Generate printable receipt
* Export as PDF
* Print directly

### Receipt Includes:

* Institution Name & Logo
* Receipt Number
* Student Name
* Amount
* Date
* Signature / Stamp area

---

## 4. Reports

### Required Reports:

* Student list
* Class list
* Payments report (daily / monthly / or as filtered)
* Outstanding balances (optional)

---

## 5. System Requirements

### Functional:

* Arabic UI support (preferred)
* Fast data entry
* Search and filtering for all lists

### Technical:

* Web-based system
* Role-based access control
* Database-backed (e.g., MySQL or PostgreSQL)

---

## 6. Important Rules

* All IDs should be auto-generated:

  * Student ID
  * Class ID
  * Receipt Number

* Financial records:

  * Cannot be deleted
  * Only canceled with audit trail

* System must support:

  * Future integration with payment gateways
  * Export to Excel
  * Notifications (SMS / WhatsApp later)

---

## 7. Future Enhancements (Not in MVP)

* Online payment integration
* Mobile app
* SMS/WhatsApp notifications
* Parent portal
* Teacher attendance tracking

---

## 8. UI Screens (Suggested)

* Dashboard
* Students Page
* Teachers Page
* Classes Page
* Payments Page
* Reports Page
* Receipt Preview Page

---

## 9. Notes

* Keep the UI simple and user-friendly
* Optimize for speed and ease of use
* Ensure printing layout is clean and professional

---
