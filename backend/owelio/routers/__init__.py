from fastapi import APIRouter

from owelio.routers import auth, dashboard, expenses, groups, notifications, recurring, settlements

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(groups.router)
api_router.include_router(expenses.router)
api_router.include_router(settlements.router)
api_router.include_router(recurring.router)
api_router.include_router(notifications.router)
api_router.include_router(dashboard.router)
