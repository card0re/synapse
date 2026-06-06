import { Navigate, Outlet } from "react-router-dom"

export default function PublicRoute() {
    const token = localStorage.getItem("token")

    if (token) {
        return <Navigate to="/feed" replace />
    }

    return <Outlet />
}