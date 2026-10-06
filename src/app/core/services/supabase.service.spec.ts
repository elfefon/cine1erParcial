import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SupabaseService', () => {
  let service: SupabaseService;
  
  // Create a mock of the Supabase client chain
  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseService]
    });
    service = TestBed.inject(SupabaseService);
    
    // Replace the internal supabase client with our mock
    (service as any)._supabase = mockSupabaseClient;
    
    // Clear mock history before each test
    vi.clearAllMocks();
  });

  it('should getTableData', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    mockSupabaseClient.select.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.getTableData('test_table');
    
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_table');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('*');
    expect(result).toEqual(mockData);
  });

  it('should insertData', async () => {
    const mockPayload = { name: 'New' };
    const mockData = { id: 1, ...mockPayload };
    
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.insertData('test_table', mockPayload);
    
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_table');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(mockPayload);
    expect(mockSupabaseClient.select).toHaveBeenCalled();
    expect(mockSupabaseClient.single).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });

  it('should updateData', async () => {
    const mockPayload = { name: 'Updated' };
    const mockData = { id: 1, ...mockPayload };
    
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.updateData('test_table', '1', mockPayload);
    
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_table');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(mockPayload);
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '1');
    expect(mockSupabaseClient.select).toHaveBeenCalled();
    expect(mockSupabaseClient.single).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });

  it('should deleteData', async () => {
    mockSupabaseClient.eq.mockResolvedValueOnce({ error: null });

    await service.deleteData('test_table', '1');
    
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_table');
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '1');
  });
});
