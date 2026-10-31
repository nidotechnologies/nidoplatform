// Mock Data Store - All data is stored locally with no external dependencies
export const mockClients = [
  {
    id: "CLI-001",
    company_name: "Acme Corporation",
    category: "Technology",
    client_tier: "Premium Clients",
    pricing_tier: "Premium",
    contract_type: "Standard",
    contact_person: "John Smith",
    email: "john.smith@acme.com",
    phone: "+1-555-0101",
    mobile: "+1-555-0102",
    website: "https://acme.com",
    contract_start: "2023-01-15",
    contract_end: "2025-01-15",
    contract_start_date: "2023-01-15",
    contract_end_date: "2025-01-15",
    client_logo_url: "https://via.placeholder.com/100",
    gst_treatment: "Regular",
    gstin: "27AABCU9603R1Z0",
    source_of_supply: "Intra State",
    pan_number: "AAAPA1234A",
    currency: "INR",
    opening_balance: 50000,
    payment_terms: "Net 30",
    tds_rate: 2.5,
    bank_name: "HDFC Bank",
    account_number: "1234567890",
    ifsc_code: "HDFC0000001",
    branch: "Mumbai",
    billing_address: "123 Business St",
    billing_city: "Mumbai",
    billing_state: "Maharashtra",
    billing_pincode: "400001",
    shipping_address: "456 Supply Ave",
    shipping_city: "Pune",
    shipping_state: "Maharashtra",
    shipping_pincode: "411001",
    status: "active",
    is_archived: false,
    created_at: "2023-01-15",
  },
  {
    id: "CLI-002",
    company_name: "TechVision Solutions",
    category: "IT Services",
    client_tier: "Premium Clients",
    pricing_tier: "Premium",
    contract_type: "Standard",
    contact_person: "Sarah Johnson",
    email: "sarah@techvision.com",
    phone: "+1-555-0201",
    mobile: "+1-555-0202",
    website: "https://techvision.com",
    contract_start: "2023-06-01",
    contract_end: "2025-06-01",
    contract_start_date: "2023-06-01",
    contract_end_date: "2025-06-01",
    client_logo_url: "https://via.placeholder.com/100",
    gst_treatment: "Regular",
    gstin: "27AABCT1234A1Z5",
    source_of_supply: "Intra State",
    pan_number: "AABPT5678B",
    currency: "INR",
    opening_balance: 75000,
    payment_terms: "Net 45",
    tds_rate: 2.0,
    bank_name: "ICICI Bank",
    account_number: "9876543210",
    ifsc_code: "ICIC0000001",
    branch: "Bangalore",
    billing_address: "789 Tech Park",
    billing_city: "Bangalore",
    billing_state: "Karnataka",
    billing_pincode: "560001",
    shipping_address: "101 Innovation Way",
    shipping_city: "Bangalore",
    shipping_state: "Karnataka",
    shipping_pincode: "560034",
    status: "active",
    is_archived: false,
    created_at: "2023-06-01",
  },
  {
    id: "CLI-003",
    company_name: "Global Enterprises",
    category: "Manufacturing",
    client_tier: "Standard Clients",
    pricing_tier: "Standard",
    contract_type: "Standard",
    contact_person: "Michael Brown",
    email: "michael@globalent.com",
    phone: "+1-555-0301",
    mobile: "+1-555-0302",
    website: "https://globalent.com",
    contract_start: "2022-09-01",
    contract_end: "2024-09-01",
    contract_start_date: "2022-09-01",
    contract_end_date: "2024-09-01",
    client_logo_url: "https://via.placeholder.com/100",
    gst_treatment: "Regular",
    gstin: "27AABCM5678A1Z0",
    source_of_supply: "Intra State",
    pan_number: "AACPD1234C",
    currency: "INR",
    opening_balance: 100000,
    payment_terms: "Net 60",
    tds_rate: 1.0,
    bank_name: "Axis Bank",
    account_number: "1111111111",
    ifsc_code: "AXIS0000001",
    branch: "Delhi",
    billing_address: "202 Industrial Zone",
    billing_city: "Delhi",
    billing_state: "Delhi",
    billing_pincode: "110001",
    shipping_address: "303 Factory Area",
    shipping_city: "Noida",
    shipping_state: "Uttar Pradesh",
    shipping_pincode: "201301",
    status: "pending",
    is_archived: false,
    created_at: "2022-09-01",
  },
  {
    id: "CLI-004",
    company_name: "RetailMax Inc",
    category: "Retail",
    client_tier: "Standard Clients",
    pricing_tier: "Standard",
    contract_type: "Standard",
    contact_person: "Emma Davis",
    email: "emma@retailmax.com",
    phone: "+1-555-0401",
    mobile: "+1-555-0402",
    website: "https://retailmax.com",
    contract_start: "2024-01-10",
    contract_end: "2025-01-10",
    contract_start_date: "2024-01-10",
    contract_end_date: "2025-01-10",
    client_logo_url: "https://via.placeholder.com/100",
    gst_treatment: "Regular",
    gstin: "27AABCR9876B1Z0",
    source_of_supply: "Inter State",
    pan_number: "AADPR2468D",
    currency: "INR",
    opening_balance: 25000,
    payment_terms: "Net 30",
    tds_rate: 2.5,
    bank_name: "Kotak Mahindra",
    account_number: "2222222222",
    ifsc_code: "KKBK0000001",
    branch: "Hyderabad",
    billing_address: "404 Retail Square",
    billing_city: "Hyderabad",
    billing_state: "Telangana",
    billing_pincode: "500001",
    shipping_address: "505 Shopping District",
    shipping_city: "Hyderabad",
    shipping_state: "Telangana",
    shipping_pincode: "500034",
    status: "inactive",
    is_archived: false,
    created_at: "2024-01-10",
  },
];

export const mockClientUsers = {
  "CLI-001": [
    {
      id: "USR-001",
      client_id: "CLI-001",
      user_name: "John Admin",
      email: "john.admin@acme.com",
      role: "Admin",
      status: "active",
      department: "Management",
      created_at: "2023-02-01",
    },
    {
      id: "USR-002",
      client_id: "CLI-001",
      user_name: "Jane Procurement",
      email: "jane.proc@acme.com",
      role: "Procurement Manager",
      status: "active",
      department: "Procurement",
      created_at: "2023-03-15",
    },
  ],
  "CLI-002": [
    {
      id: "USR-003",
      client_id: "CLI-002",
      user_name: "Bob Manager",
      email: "bob.manager@techvision.com",
      role: "Manager",
      status: "active",
      department: "Operations",
      created_at: "2023-07-01",
    },
  ],
};

// In-memory storage for runtime changes
let clientsStore = JSON.parse(JSON.stringify(mockClients));
let clientUsersStore = JSON.parse(JSON.stringify(mockClientUsers));

export const mockDataService = {
  // Clients
  getClients: () => JSON.parse(JSON.stringify(clientsStore)),
  getClientById: (id: string) => clientsStore.find((c: any) => c.id === id),
  addClient: (client: any) => {
    clientsStore.push(client);
  },
  updateClient: (id: string, updates: any) => {
    const index = clientsStore.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      clientsStore[index] = { ...clientsStore[index], ...updates };
    }
  },
  deleteClient: (id: string) => {
    clientsStore = clientsStore.filter((c: any) => c.id !== id);
  },

  // Client Users
  getClientUsers: (clientId: string) => {
    return (clientUsersStore as any)[clientId] || [];
  },
  addClientUser: (clientId: string, user: any) => {
    if (!(clientUsersStore as any)[clientId]) {
      (clientUsersStore as any)[clientId] = [];
    }
    (clientUsersStore as any)[clientId].push(user);
  },
  updateClientUser: (clientId: string, userId: string, updates: any) => {
    const users = (clientUsersStore as any)[clientId];
    if (users) {
      const index = users.findIndex((u: any) => u.id === userId);
      if (index !== -1) {
        users[index] = { ...users[index], ...updates };
      }
    }
  },
};
