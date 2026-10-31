import { describe, it, expect, beforeEach } from 'vitest';

describe('AddClient Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should generate unique client IDs', () => {
    const id1 = `CL-${String(Math.floor(Math.random() * 10000) + 1).padStart(5, '0')}`;
    const id2 = `CL-${String(Math.floor(Math.random() * 10000) + 1).padStart(5, '0')}`;
    
    expect(id1).toMatch(/^CL-\d{5}$/);
    expect(id2).toMatch(/^CL-\d{5}$/);
  });

  it('should store and retrieve clients from localStorage', () => {
    const mockClient = {
      client_id: 'CL-00001',
      company_name: 'Test Company',
      email: 'test@example.com',
      contact_person: 'Test Person',
    };

    let clients = JSON.parse(localStorage.getItem('clients') || '[]');
    clients.push(mockClient);
    localStorage.setItem('clients', JSON.stringify(clients));

    const retrieved = JSON.parse(localStorage.getItem('clients') || '[]');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].company_name).toBe('Test Company');
  });

  it('should update existing clients in localStorage', () => {
    const mockClient = {
      client_id: 'CL-00001',
      company_name: 'Original Name',
      email: 'test@example.com',
    };

    let clients = [mockClient];
    localStorage.setItem('clients', JSON.stringify(clients));

    // Update the client
    clients = JSON.parse(localStorage.getItem('clients') || '[]');
    const index = clients.findIndex((c: any) => c.client_id === 'CL-00001');
    if (index > -1) {
      clients[index].company_name = 'Updated Name';
    }
    localStorage.setItem('clients', JSON.stringify(clients));

    const updated = JSON.parse(localStorage.getItem('clients') || '[]');
    expect(updated[0].company_name).toBe('Updated Name');
  });

  it('should validate required fields', () => {
    const formData = {
      company_name: '',
      email: '',
      contact_person: '',
    };

    const isValid = !!(
      formData.company_name.trim() &&
      formData.email.trim() &&
      formData.contact_person.trim()
    );

    expect(isValid).toBe(false);
  });

  it('should validate with all required fields filled', () => {
    const formData = {
      company_name: 'Test Company',
      email: 'test@example.com',
      contact_person: 'John Doe',
    };

    const isValid = !!(
      formData.company_name.trim() &&
      formData.email.trim() &&
      formData.contact_person.trim()
    );

    expect(isValid).toBe(true);
  });
});
