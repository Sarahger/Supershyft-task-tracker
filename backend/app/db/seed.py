"""Seed the database with realistic sample data."""

from datetime import datetime, timedelta, timezone

from app.core.security import get_password_hash
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.models import (
    Checklist,
    ChecklistItem,
    Client,
    Comment,
    Department,
    Milestone,
    Project,
    Sprint,
    Tag,
    Task,
    TaskAssignee,
    TaskDependency,
    TaskType,
    User,
)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(User).first():
        print("Database already seeded. Skipping.")
        db.close()
        return

    now = datetime.now(timezone.utc)

    # Departments
    dept_names = ["Technology", "Product", "Design", "Marketing", "Sales", "Operations", "Finance", "HR"]
    departments = {}
    for name in dept_names:
        d = Department(name=name, description=f"{name} department")
        db.add(d)
        departments[name] = d
    db.flush()

    # Admin
    admin = User(
        first_name="Sarah",
        last_name="Admin",
        email="admin@company.com",
        hashed_password=get_password_hash("admin123"),
        role="administrator",
        status="active",
        job_title="CEO & Founder",
    )
    admin.departments = [departments["Technology"], departments["Product"]]
    db.add(admin)

    # Managers
    managers = []
    manager_data = [
        ("James", "Chen", "james@company.com", "Technology", "Engineering Manager"),
        ("Maria", "Rodriguez", "maria@company.com", "Design", "Design Lead"),
        ("David", "Kim", "david@company.com", "Marketing", "Marketing Director"),
    ]
    for fn, ln, email, dept, title in manager_data:
        m = User(
            first_name=fn,
            last_name=ln,
            email=email,
            hashed_password=get_password_hash("manager123"),
            role="manager",
            status="active",
            job_title=title,
            manager_id=None,
        )
        m.departments = [departments[dept]]
        departments[dept].manager_id = None  # set after flush
        managers.append(m)
        db.add(m)
    db.flush()

    departments["Technology"].manager_id = managers[0].id
    departments["Design"].manager_id = managers[1].id
    departments["Marketing"].manager_id = managers[2].id

    # Employees
    employees = []
    emp_data = [
        ("Alex", "Johnson", "alex@company.com", ["Technology"], "Senior Developer"),
        ("Emily", "Williams", "emily@company.com", ["Technology"], "Frontend Developer"),
        ("Michael", "Brown", "michael@company.com", ["Technology", "Product"], "Backend Developer"),
        ("Sophia", "Davis", "sophia@company.com", ["Design"], "UI Designer"),
        ("Daniel", "Miller", "daniel@company.com", ["Design", "Marketing"], "UX Designer"),
        ("Olivia", "Wilson", "olivia@company.com", ["Marketing"], "Content Strategist"),
        ("Ethan", "Taylor", "ethan@company.com", ["Operations"], "Operations Manager"),
        ("Isabella", "Anderson", "isabella@company.com", ["Finance"], "Financial Analyst"),
        ("Noah", "Thomas", "noah@company.com", ["HR"], "HR Specialist"),
        ("Ava", "Martinez", "ava@company.com", ["Sales"], "Sales Representative"),
        ("Liam", "Garcia", "liam@company.com", ["Technology"], "DevOps Engineer"),
        ("Mia", "Lee", "mia@company.com", ["Product"], "Product Manager"),
    ]
    for fn, ln, email, depts, title in emp_data:
        e = User(
            first_name=fn,
            last_name=ln,
            email=email,
            hashed_password=get_password_hash("employee123"),
            role="employee",
            status="active",
            job_title=title,
            manager_id=managers[0].id if "Technology" in depts else managers[1].id if "Design" in depts else managers[2].id,
        )
        e.departments = [departments[d] for d in depts]
        employees.append(e)
        db.add(e)
    db.flush()

    all_users = [admin] + managers + employees

    # Task Types
    type_names = ["Feature", "Bug", "Design", "Research", "Marketing", "Meeting", "Documentation", "Testing", "Operations", "General"]
    colors = ["#3B82F6", "#EF4444", "#8B5CF6", "#F59E0B", "#EC4899", "#6B7280", "#10B981", "#F97316", "#6366F1", "#94A3B8"]
    task_types = {}
    for name, color in zip(type_names, colors):
        tt = TaskType(name=name, color=color)
        db.add(tt)
        task_types[name] = tt
    db.flush()

    # Tags
    tag_names = ["urgent", "frontend", "backend", "mobile", "api", "ui", "qa", "release", "v2", "client-facing"]
    tags = {}
    for name in tag_names:
        t = Tag(name=name, color="#64748B")
        db.add(t)
        tags[name] = t
    db.flush()

    # Clients
    clients = {}
    for name in ["Acme Corp", "TechStart Inc", "Global Health NGO"]:
        c = Client(name=name, notes=f"Client: {name}")
        db.add(c)
        clients[name] = c
    db.flush()

    # Projects
    project_data = [
        ("Mobile App", "Native mobile application for iOS and Android", "active", "healthy"),
        ("Website Redesign", "Complete overhaul of company website", "active", "at_risk"),
        ("Admin Dashboard", "Internal admin dashboard rebuild", "active", "healthy"),
        ("Marketing Campaign Q2", "Q2 marketing campaign across channels", "active", "healthy"),
        ("Health Camp", "Community health camp initiative", "planning", "healthy"),
        ("Documentation", "Technical documentation overhaul", "active", "delayed"),
    ]
    projects = {}
    for name, desc, status, health in project_data:
        p = Project(
            name=name,
            description=desc,
            status=status,
            health=health,
            start_date=now - timedelta(days=30),
            end_date=now + timedelta(days=60),
            created_by_id=managers[0].id,
        )
        db.add(p)
        projects[name] = p
    db.flush()

    # Sprint & Milestone
    sprint = Sprint(name="Sprint 12", start_date=now - timedelta(days=7), end_date=now + timedelta(days=7), is_active=True)
    db.add(sprint)
    milestone = Milestone(name="MVP Launch", due_date=now + timedelta(days=30), project_id=projects["Mobile App"].id)
    db.add(milestone)
    db.flush()

    # Tasks
    task_specs = [
        ("Implement user authentication", "Feature", "high", "in_progress", "Mobile App", ["Alex", "Michael"], "James", True, False, 16),
        ("Fix login redirect bug", "Bug", "critical", "to_do", "Mobile App", ["Alex"], "James", True, True, 4),
        ("Design onboarding screens", "Design", "high", "in_review", "Mobile App", ["Sophia"], "Maria", True, False, 12),
        ("API rate limiting", "Feature", "medium", "backlog", "Admin Dashboard", ["Michael"], "James", True, False, 8),
        ("Write API documentation", "Documentation", "low", "completed", "Documentation", ["Michael"], "James", False, False, 6),
        ("Homepage hero section", "Design", "high", "in_progress", "Website Redesign", ["Sophia", "Daniel"], "Maria", True, False, 10),
        ("SEO optimization", "Marketing", "medium", "to_do", "Website Redesign", ["Olivia"], "David", False, False, 8),
        ("Social media campaign", "Marketing", "high", "in_progress", "Marketing Campaign Q2", ["Olivia"], "David", False, False, 20),
        ("Email newsletter template", "Marketing", "medium", "backlog", "Marketing Campaign Q2", ["Olivia"], "David", False, False, 6),
        ("Setup CI/CD pipeline", "Operations", "high", "completed", "Admin Dashboard", ["Liam"], "James", True, True, 12),
        ("Database migration script", "Feature", "critical", "blocked", "Admin Dashboard", ["Michael", "Liam"], "James", True, False, 8),
        ("User profile page", "Feature", "medium", "ready_for_review", "Mobile App", ["Emily"], "James", True, False, 10),
        ("Payment integration", "Feature", "critical", "to_do", "Mobile App", ["Alex", "Michael"], "James", True, True, 24),
        ("Accessibility audit", "Testing", "medium", "testing", "Website Redesign", ["Daniel"], "Maria", True, True, 8),
        ("Performance optimization", "Feature", "high", "in_progress", "Website Redesign", ["Emily"], "James", True, False, 16),
        ("Health camp logistics", "Operations", "medium", "to_do", "Health Camp", ["Ethan"], "David", False, False, 12),
        ("Vendor contract review", "Operations", "low", "backlog", "Health Camp", ["Ethan"], "David", False, False, 4),
        ("Budget planning Q3", "General", "medium", "to_do", None, ["Isabella"], "James", False, False, 6),
        ("Employee onboarding flow", "Feature", "medium", "in_progress", "Admin Dashboard", ["Mia", "Emily"], "James", True, False, 14),
        ("Bug: Dashboard charts not loading", "Bug", "major", "in_progress", "Admin Dashboard", ["Emily"], "James", True, False, 4),
        ("Research competitor features", "Research", "low", "completed", "Product", ["Mia"], "James", False, False, 8),
        ("Team standup notes", "Meeting", "low", "completed", None, ["Alex"], None, False, False, 1),
        ("Client demo preparation", "General", "high", "to_do", "Mobile App", ["Mia", "Alex"], "James", True, False, 6),
        ("Sales pitch deck update", "Marketing", "medium", "backlog", None, ["Ava"], "David", False, False, 8),
        ("HR policy documentation", "Documentation", "low", "to_do", None, ["Noah"], "James", False, False, 10),
        ("Fix mobile navigation", "Bug", "high", "changes_requested", "Mobile App", ["Emily"], "James", True, False, 6),
        ("Analytics dashboard", "Feature", "medium", "unassigned", "Admin Dashboard", [], "James", True, False, 20),
        ("Brand guidelines update", "Design", "low", "backlog", "Marketing Campaign Q2", ["Sophia"], "Maria", False, False, 8),
        ("Load testing", "Testing", "high", "approved", "Mobile App", ["Liam"], "James", True, True, 12),
        ("Security audit", "Testing", "critical", "cancelled", "Admin Dashboard", ["Liam"], "James", True, True, 16),
    ]

    user_map = {u.first_name: u for u in all_users}
    created_tasks = []

    for i, spec in enumerate(task_specs):
        title, ttype, priority, status, project, assignees, reviewer, review_req, test_req, hours = spec
        task = Task(
            title=title,
            description=f"Detailed description for: {title}. This task involves multiple steps and coordination across teams.",
            task_type_id=task_types[ttype].id,
            priority=priority if priority != "major" else "high",
            status=status,
            severity="major" if ttype == "Bug" and priority == "major" else ("critical" if ttype == "Bug" and priority == "critical" else None),
            estimated_hours=hours,
            start_date=now - timedelta(days=10 + i),
            due_date=now + timedelta(days=i * 2 - 5),
            project_id=projects[project].id if project and project in projects else (projects["Mobile App"].id if project == "Product" else None),
            client_id=clients["Acme Corp"].id if i % 3 == 0 else None,
            sprint_id=sprint.id if i < 20 else None,
            milestone_id=milestone.id if "Mobile" in (project or "") else None,
            reviewer_id=user_map[reviewer].id if reviewer and reviewer in user_map else managers[0].id,
            review_required=review_req,
            testing_required=test_req,
            created_by_id=admin.id,
        )

        if status == "blocked":
            task.previous_status = "in_progress"
            task.block_reason = "Waiting for third-party API access"
            task.blocked_by_id = user_map[assignees[0]].id if assignees else managers[0].id
            task.blocked_at = now - timedelta(days=2)

        if status == "completed":
            task.completed_at = now - timedelta(days=1)

        for name in assignees:
            if name in user_map:
                completed = status in ("ready_for_review", "in_review", "approved", "testing", "completed")
                task.assignees.append(TaskAssignee(user_id=user_map[name].id, is_completed=completed))

        task.departments = [departments["Technology"]] if ttype in ("Feature", "Bug", "Testing") else [departments["Design"]] if ttype == "Design" else [departments["Marketing"]]
        task.tags = [tags["frontend"]] if "mobile" in title.lower() or "page" in title.lower() else [tags["backend"]] if "api" in title.lower() else []

        db.add(task)
        created_tasks.append(task)

    db.flush()

    # Dependencies
    if len(created_tasks) >= 3:
        db.add(TaskDependency(task_id=created_tasks[2].id, depends_on_id=created_tasks[0].id))
        db.add(TaskDependency(task_id=created_tasks[12].id, depends_on_id=created_tasks[0].id))

    # Checklists
    for task in created_tasks[:10]:
        cl = Checklist(task_id=task.id, title="Implementation Checklist")
        items = ["Review requirements", "Implement solution", "Write tests", "Update documentation"]
        for j, item_title in enumerate(items):
            cl.items.append(ChecklistItem(title=item_title, is_completed=j < 2, sort_order=j))
        db.add(cl)

    # Comments
    comment_texts = [
        "Started working on this. Will update by EOD.",
        "Blocked on API credentials - reaching out to vendor.",
        "LGTM, minor suggestions in the design file.",
        "Can we prioritize this for the sprint?",
        "Updated the PR with requested changes.",
    ]
    for i, task in enumerate(created_tasks[:15]):
        c = Comment(
            task_id=task.id,
            author_id=all_users[i % len(all_users)].id,
            content=comment_texts[i % len(comment_texts)],
        )
        db.add(c)

    db.commit()
    print("Database seeded successfully!")
    print("\nLogin credentials:")
    print("  Admin:    admin@company.com / admin123")
    print("  Manager:  james@company.com / manager123")
    print("  Employee: alex@company.com / employee123")
    db.close()


if __name__ == "__main__":
    seed()
