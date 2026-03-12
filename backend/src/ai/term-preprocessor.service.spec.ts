import { Test, TestingModule } from '@nestjs/testing';
import { TermPreprocessorService } from './term-preprocessor.service';
import * as fs from 'fs-extra';

jest.mock('fs-extra');

describe('TermPreprocessorService', () => {
  let service: TermPreprocessorService;

  const mockDictionary = {
    POL: 'POL (Port of Loading - Cảng xếp hàng)',
    THC: 'THC (Terminal Handling Charge - Phí xếp dỡ tại cảng)',
    CFS: 'CFS (Container Freight Station Fee - Phí bốc xếp, quản lý kho bãi LCL)',
    'D/O': 'D/O (Delivery Order Fee - Phí lệnh giao hàng)',
    LCC: 'LCC charges (Local Charges POL & POD - Phí địa phương 2 đầu)',
  };

  beforeEach(async () => {
    // Mock fs-extra to return our test dictionary instead of reading from disk
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readJsonSync as jest.Mock).mockReturnValue(mockDictionary);

    const module: TestingModule = await Test.createTestingModule({
      providers: [TermPreprocessorService],
    }).compile();

    service = module.get<TermPreprocessorService>(TermPreprocessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('TC-TERM-01: Should load dictionary properly', () => {
    expect(service).toBeDefined();
    // processText should modify a valid term mapped in the dictionary
    const out = service.processText('THC');
    expect(out).toContain('Terminal Handling Charge');
  });

  it('TC-TERM-02: Should replace simple acronym correctly', () => {
    const input = 'THC: 9 USD/RT';
    const output = service.processText(input);
    expect(output).toBe(
      'THC (Terminal Handling Charge - Phí xếp dỡ tại cảng): 9 USD/RT',
    );
  });

  it('TC-TERM-03: Should replace multiple acronyms in one string', () => {
    const input = 'LCC charges gồm THC, CFS và D/O';
    const output = service.processText(input);
    expect(output).toContain('LCC charges (Local Charges POL & POD');
    expect(output).toContain('THC (Terminal Handling Charge');
    expect(output).toContain('CFS (Container Freight Station Fee');
    expect(output).toContain('D/O (Delivery Order Fee');
  });

  it('TC-TERM-04: Should not mistakenly replace embedded strings', () => {
    const input = 'CODETHC123 và THC 9 USD';
    const output = service.processText(input);
    // 'CODETHC123' should remain intact
    expect(output).toContain('CODETHC123');
    // The standalone 'THC' should be replaced
    expect(output).toContain('THC (Terminal Handling Charge');
  });

  it('TC-TERM-05: Should not break numerical formats or currencies', () => {
    const input = 'THC: 9 USD/RT, CFS: 15 USD/RT';
    const output = service.processText(input);
    expect(output).toContain('9 USD/RT');
    expect(output).toContain('15 USD/RT');
    // Verify replacements
    expect(output).toContain('THC (Terminal Handling Charge');
    expect(output).toContain('CFS (Container Freight Station Fee');
  });
});
