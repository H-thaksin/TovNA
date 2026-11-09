import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminUsers.css";

const ROLE_IDS = {
  customer: 1,
  admin: 2,
  agent: 3,
};

export default function AdminUsers({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API_URL}/admin/users?limit=200&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setUsers(data);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUser = async (userId, endpoint, body) => {
    try {
      setUpdatingId(userId);
      setError("");
      setNotice("");

      const token = localStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/admin/users/${userId}/${endpoint}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setNotice(data.message || "User updated successfully.");

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to update user.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = (user, newRoleId) => {
    if (newRoleId === user.role_id) return;

    const confirmed = window.confirm(
      `Change ${user.first_name} ${user.last_name}'s role to ${
        newRoleId === 1 ? "Customer" : newRoleId === 2 ? "Admin" : "Agent"
      }?`,
    );

    if (!confirmed) return;

    updateUser(user.id, "role", {
      role_id: Number(newRoleId),
    });
  };

  const handleActiveChange = (user) => {
    const nextStatus = !user.is_active;

    const confirmed = window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${
        user.first_name
      } ${user.last_name}'s account?`,
    );

    if (!confirmed) return;

    updateUser(user.id, "active", {
      is_active: nextStatus,
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.first_name || ""} ${
        user.last_name || ""
      }`.toLowerCase();

      const searchMatch =
        fullName.includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());

      const roleMatch = roleFilter === "all" || user.role === roleFilter;

      return searchMatch && roleMatch;
    });
  }, [users, search, roleFilter]);

  if (loading) {
    return <div className="admin-message">Loading users...</div>;
  }

  return (
    <div className="admin-users">
      <div className="admin-users-heading">
        <div>
          <h1>User Management</h1>
          <p>Manage customer and staff accounts on TovNa.</p>
        </div>

        <button className="admin-refresh-btn" onClick={loadUsers}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="admin-users-alert error">{error}</div>}

      {notice && <div className="admin-users-alert success">{notice}</div>}

      <div className="admin-users-summary">
        <div className="admin-users-summary-card">
          <span>Total Users</span>
          <strong>{users.length}</strong>
        </div>

        <div className="admin-users-summary-card">
          <span>Customers</span>
          <strong>
            {users.filter((user) => user.role === "customer").length}
          </strong>
        </div>

        <div className="admin-users-summary-card">
          <span>Agents</span>
          <strong>
            {users.filter((user) => user.role === "agent").length}
          </strong>
        </div>

        <div className="admin-users-summary-card">
          <span>Admins</span>
          <strong>
            {users.filter((user) => user.role === "admin").length}
          </strong>
        </div>
      </div>

      <div className="admin-users-panel">
        <div className="admin-users-toolbar">
          <input
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="customer">Customers</option>
            <option value="agent">Agents</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        <div className="admin-users-table-wrapper">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const isUpdating = updatingId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-table-avatar">
                          {(user.first_name || "U").charAt(0).toUpperCase()}
                        </div>

                        <div className="admin-user-table-info">
                          <strong>
                            {user.first_name} {user.last_name}
                            {isSelf && (
                              <span className="admin-you-label">You</span>
                            )}
                          </strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>{user.phone || "—"}</td>

                    <td>
                      <select
                        className="admin-role-select"
                        value={user.role_id}
                        disabled={isSelf || isUpdating}
                        onChange={(event) =>
                          handleRoleChange(user, event.target.value)
                        }
                      >
                        <option value={ROLE_IDS.customer}>Customer</option>
                        <option value={ROLE_IDS.agent}>Agent</option>
                        <option value={ROLE_IDS.admin}>Admin</option>
                      </select>
                    </td>

                    <td>
                      <span
                        className={`admin-account-status ${
                          user.is_active ? "active" : "inactive"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <button
                        className={`admin-account-action ${
                          user.is_active ? "deactivate" : "activate"
                        }`}
                        disabled={isSelf || isUpdating}
                        onClick={() => handleActiveChange(user)}
                      >
                        {isUpdating
                          ? "Updating..."
                          : user.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="admin-users-empty">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-users-footer">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>
    </div>
  );
}
