"""Routers package."""
from .programs import router as programs_router
from .inputs import router as inputs_router
from .signals import router as signals_router
from .costs import router as costs_router
from .overrides import router as overrides_router
from .samples import router as samples_router

__all__ = [
    "programs_router",
    "inputs_router",
    "signals_router",
    "costs_router",
    "overrides_router",
    "samples_router"
]
