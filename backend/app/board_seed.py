DEFAULT_BOARD = {
    "columns": [
        {
            "id": "col-backlog",
            "title": "Backlog",
            "color": "#3B82F6",
            "icon": "inbox",
            "cardIds": ["card-1", "card-2"],
        },
        {
            "id": "col-discovery",
            "title": "Discovery",
            "color": "#8B5CF6",
            "icon": "search",
            "cardIds": ["card-3"],
        },
        {
            "id": "col-progress",
            "title": "In Progress",
            "color": "#EC4899",
            "icon": "play",
            "cardIds": ["card-4", "card-5"],
        },
        {
            "id": "col-review",
            "title": "Review",
            "color": "#EF4444",
            "icon": "eye",
            "cardIds": ["card-6"],
        },
        {
            "id": "col-done",
            "title": "Done",
            "color": "#F97316",
            "icon": "check-circle",
            "cardIds": ["card-7", "card-8"],
        },
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
            "priority": "high",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
            "priority": "medium",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
            "priority": "critical",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
            "priority": "medium",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
            "priority": "high",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
            "priority": "critical",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
            "priority": "low",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
            "priority": "low",
        },
    },
}
