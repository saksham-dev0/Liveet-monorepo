import React, { createContext, useContext, useState, useEffect } from "react";
import { useConvex } from "convex/react";

type Role = "owner" | "manager" | null;

type PropertyRoleContextType = {
  activePropertyId: string | null;
  setActivePropertyId: (id: string | null) => void;
  role: Role;
  isOwner: boolean;
  canViewContacts: boolean;
};

const PropertyRoleContext = createContext<PropertyRoleContextType>({
  activePropertyId: null,
  setActivePropertyId: () => {},
  role: null,
  isOwner: false,
  canViewContacts: false,
});

export function PropertyRoleProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    if (!activePropertyId) {
      setRole(null);
      return;
    }
    let cancelled = false;
    (convex as any)
      .query("propertyMembers:getMyRoleForProperty", { propertyId: activePropertyId })
      .then((r: Role) => { if (!cancelled) setRole(r); })
      .catch(() => { if (!cancelled) setRole(null); });
    return () => { cancelled = true; };
  }, [activePropertyId, convex]);

  const handleSetProperty = (id: string | null) => {
    setActivePropertyId(id);
    if (!id) setRole(null);
  };

  return (
    <PropertyRoleContext.Provider
      value={{
        activePropertyId,
        setActivePropertyId: handleSetProperty,
        role,
        isOwner: role === "owner",
        canViewContacts: role === "owner",
      }}
    >
      {children}
    </PropertyRoleContext.Provider>
  );
}

export const usePropertyRole = () => useContext(PropertyRoleContext);
