// The terms, privacy and refund policies. Plain-language drafts for a small Indian business: have
// them checked by a lawyer or CA before launch, and change the refund rules below to match how you
// actually work. The business name, email, phone and address come from the dashboard's Settings.
//
// In the text, {business}, {email}, {phone}, {address}, {responseTime} and {holdMinutes} are filled
// in on the page, and [words](/path) becomes a link.

export const UPDATED = "7 October 2026";

/** Cancellation rules, used in the refund policy and the terms. Change the numbers to suit you. */
export const REFUND_RULES = {
  fullRefundDays: 7, // cancel this many days or more before: full refund
  partRefundDays: 2, // cancel between this and fullRefundDays: partRefundPercent back
  partRefundPercent: 50,
  refundWorkingDays: "5 to 7" // how long Razorpay refunds take to reach the customer
};

export interface PolicySection { heading: string; paragraphs?: string[]; list?: string[] }
export interface Policy { path: string; eyebrow: string; title: string; intro: string; sections: PolicySection[] }

const r = REFUND_RULES;

export const TERMS: Policy = {
  path: "/terms",
  eyebrow: "TERMS / BOOKINGS AND THE WEBSITE",
  title: "Terms and conditions",
  intro: "These terms apply when you book a GROWND session or use this website. They are written to be read: if anything is unclear, ask us at {email}.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: ["GROWND is run by {business} (\"GROWND\", \"we\", \"us\"). We run hands-on science sessions for children aged 5 to 12: birthday parties, workshops, school events and coding sessions. You can reach us at {email} or {phone}, or write to {address}."]
    },
    {
      heading: "Booking a session",
      list: [
        "When you register interest, nothing is booked and you pay nothing. We reply within {responseTime} with dates, a price and any questions.",
        "When you book a date online, your places are held for {holdMinutes} minutes while you pay. The booking is confirmed once the payment succeeds, and Razorpay emails you a receipt.",
        "For parties and school visits we may send a payment link instead. The booking is confirmed once that link is paid.",
        "Prices are in Indian rupees (₹) and are the total you pay. Each date shows how many places are left, and we never sell more places than a session holds."
      ]
    },
    {
      heading: "Payments",
      paragraphs: ["Payments are processed by Razorpay Software Private Limited. You enter your card, UPI, netbanking or wallet details on Razorpay's page, never on ours, and GROWND never sees them. Razorpay's own terms apply to the payment itself."]
    },
    {
      heading: "Cancelling or changing a booking",
      paragraphs: [`You can cancel or move a booking by emailing {email}. The [cancellation and refund policy](/refunds) explains what you get back: in short, a full refund up to ${r.fullRefundDays} days before the session, and ${r.partRefundPercent}% up to ${r.partRefundDays} days before. If we have to cancel, you always get a full refund or a new date, whichever you prefer.`]
    },
    {
      heading: "Shipping and delivery",
      paragraphs: ["We sell sessions, not goods, so nothing is shipped. A session is delivered in person by our team at the venue and on the date and time in your booking confirmation. Anything children make during a session is theirs to take home on the day."]
    },
    {
      heading: "On the day",
      list: [
        "A parent, guardian or teacher responsible for the children stays at the venue for the whole session. Our team runs the activities; they do not take over the care of the children.",
        "For sessions at your venue, please give us a clear table area, access to running water nearby, and 20 minutes before the start to set up.",
        "Tell us about allergies, medical needs or anything else that helps every child take part safely, before the day. Our materials are chosen for children and used under supervision, but some sessions use household substances such as glue, food colouring and baking soda.",
        "We may pause or stop an activity if it becomes unsafe, for example if children are not following safety instructions."
      ]
    },
    {
      heading: "Photos and videos",
      paragraphs: ["We only take photos or videos of children with a parent's or guardian's written consent, and we never publish a child's name. You can ask us to delete any photo of your child at any time."]
    },
    {
      heading: "Our responsibility to you",
      paragraphs: [
        "We take reasonable care to run every session safely and as described. If something goes wrong because of our negligence, we are responsible for it.",
        "Apart from that, our total responsibility for any booking is limited to the amount you paid for it, and we are not responsible for losses we could not reasonably have foreseen. Nothing in these terms takes away rights you have under Indian consumer law."
      ]
    },
    {
      heading: "Using this website",
      paragraphs: ["The words, designs and images on this website belong to GROWND. You may share links to it freely. Please do not copy the content for commercial use, or try to break, overload or get around the security of the website or its booking system."]
    },
    {
      heading: "Law and disputes",
      paragraphs: ["These terms are governed by the laws of India. If you have a complaint, please write to {email} first: most problems are solved quickly that way. If we cannot resolve it, the courts where our registered office is ({address}) will decide, and you can also approach the consumer commission under the Consumer Protection Act, 2019."]
    },
    {
      heading: "Changes to these terms",
      paragraphs: ["We may update these terms as GROWND grows. The terms that apply to a booking are the ones shown here on the day you booked."]
    }
  ]
};

export const PRIVACY: Policy = {
  path: "/privacy",
  eyebrow: "PRIVACY / YOUR DETAILS",
  title: "Privacy policy",
  intro: "We collect as little as we can, use it only to run your booking, and never sell it. This policy explains what we keep, why, and how to have it changed or deleted, as the Digital Personal Data Protection Act, 2023 requires.",
  sections: [
    {
      heading: "Who is responsible",
      paragraphs: ["{business} is responsible for the personal data described here (the \"Data Fiduciary\" under the Act). For anything about your data, write to {email} with \"Privacy\" in the subject, or to {address}."]
    },
    {
      heading: "What we collect",
      list: [
        "When you register interest: your name, email address, phone number (optional), the number of children, their age range, a preferred date, your city, the type of venue and any notes you add.",
        "When you book and pay: your name, email address, phone number (optional), the number of children, their age range and any notes, plus the payment's amount, status and Razorpay reference. We never receive your card, UPI or bank details.",
        "When you visit the website: the address of your device (IP address) and basic technical details, kept in server logs for a short time to protect the site against abuse. We do not use advertising or tracking cookies, or any analytics.",
        "The scientist quiz and the light/dark theme work entirely in your browser. Your answers are not sent to us."
      ]
    },
    {
      heading: "About children",
      paragraphs: ["Our sessions are for children, but we collect details from the adults who book them: parents, guardians and teachers aged 18 or over. We do not ask for children's names. If you tell us about a child's allergy or medical need so they can take part safely, we use it only for that session. Please do not send other details about children."]
    },
    {
      heading: "Why we use it",
      list: [
        "To reply to you about the session you asked about, with your consent (the checkbox on the form). You can withdraw it at any time by emailing us.",
        "To deliver a session you booked and paid for, and to contact you about it.",
        "To take payments and issue refunds, through Razorpay.",
        "To keep the records that Indian tax and accounting law requires."
      ],
      paragraphs: ["We do not send marketing, add you to mailing lists or sell your details to anyone."]
    },
    {
      heading: "Who handles it for us",
      paragraphs: ["We use a small number of services to run the site. Each one only processes data on our instructions:"],
      list: [
        "Supabase: our database and the team's sign-in. The data is stored in Mumbai, India.",
        "Vercel: hosts the website. Your requests may be handled by its servers outside India.",
        "Razorpay: takes payments and issues refunds.",
        "Resend: sends the team an email when a registration or payment arrives, if we have switched it on.",
        "Sentry: records technical error reports so we can fix problems, if we have switched it on. These reports leave out the contents of forms."
      ]
    },
    {
      heading: "How long we keep it",
      list: [
        "Registrations of interest: up to 24 months after we were last in touch, then deleted.",
        "Bookings and payments: as long as tax and accounting law requires, currently up to 8 years.",
        "Server logs: a few days to a few weeks, depending on the hosting service."
      ]
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You can ask us for a summary of the data we hold about you, to correct or complete it, or to delete it (unless the law requires us to keep it, as with payment records). You can withdraw your consent at any time, and nominate someone to exercise these rights for you if you cannot.",
        "Email {email} and we will respond within 30 days. If you are not satisfied with our answer, you can complain to the Data Protection Board of India."
      ]
    },
    {
      heading: "How we protect it",
      paragraphs: ["Everything travels over encrypted connections (HTTPS). The database cannot be reached from the internet directly, only through our server. Only the GROWND team can see registrations and bookings, and they sign in with a password and a code from an authenticator app."]
    },
    {
      heading: "Changes to this policy",
      paragraphs: ["If we change how we use your data, we will update this page and change the date at the top. For a significant change, we will tell you by email first."]
    }
  ]
};

export const REFUNDS: Policy = {
  path: "/refunds",
  eyebrow: "REFUNDS / CANCELLING AND MOVING",
  title: "Cancellation and refund policy",
  intro: "Plans change, especially with children. Here is exactly what happens if you need to cancel or move a booking, or if we do.",
  sections: [
    {
      heading: "If you cancel",
      paragraphs: ["Email {email} with your name and the date of your booking. We count the days from when your email reaches us to the start of the session:"],
      list: [
        `${r.fullRefundDays} or more days before: a full refund.`,
        `${r.partRefundDays} to ${r.fullRefundDays - 1} days before: ${r.partRefundPercent}% back, or move to another date once at no cost.`,
        `Less than ${r.partRefundDays} days before, or not turning up: no refund. We will still try to move you to another date if one has places.`
      ]
    },
    {
      heading: "Fewer children than booked",
      paragraphs: [`Tell us ${r.fullRefundDays} or more days before and we refund the places you no longer need. After that, the places are kept for you and are not refunded.`]
    },
    {
      heading: "Moving to another date",
      paragraphs: [`You can move a booking once, at no cost, if you tell us at least ${r.partRefundDays} days before and the new date has places. If the new session costs more, you pay the difference; if it costs less, we refund it.`]
    },
    {
      heading: "If we cancel",
      paragraphs: ["If we have to cancel a session (for example because of illness, an emergency, or the venue becoming unsafe), you choose between a full refund and a new date. We tell you as early as we possibly can."]
    },
    {
      heading: "How refunds are paid",
      paragraphs: [`Refunds go back to the account or card you paid with, through Razorpay. We start the refund within 2 working days of agreeing it, and banks usually take ${r.refundWorkingDays} working days to show it. We do not charge a fee for refunds.`]
    },
    {
      heading: "Payment links and school bookings",
      paragraphs: ["The same rules apply to bookings paid through a payment link, counted from the session date we agreed. For school bookings, anything else agreed in writing with the school takes priority."]
    },
    {
      heading: "Questions",
      paragraphs: ["Write to {email} or call {phone}. We reply within {responseTime}. See also our [terms and conditions](/terms)."]
    }
  ]
};

export const POLICIES = [TERMS, PRIVACY, REFUNDS];

export interface PolicyValues { business: string; email: string; phone: string; address: string; responseTime: string; holdMinutes: number }

/** Fills in the {business}-style values. */
export function fill(text: string, v: PolicyValues) {
  return text.replace(/\{(business|email|phone|address|responseTime|holdMinutes)\}/g, (_, k: keyof PolicyValues) => String(v[k]));
}
