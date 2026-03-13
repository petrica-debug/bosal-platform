from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from scipy.optimize import minimize
import math

app = FastAPI(title="BOSAL Chemistry Engine", description="Thermodynamics and Chemical Equilibrium Solver")

class ReformerInput(BaseModel):
    CH4: float
    C2H6: float
    C3H8: float
    CO2: float
    N2: float
    SC_ratio: float
    T_C: float
    P_kPa: float

class EquilibriumResult(BaseModel):
    H2: float
    CO: float
    CO2: float
    CH4: float
    H2O: float
    N2: float
    CH4_conversion: float
    CH4_CO_ratio: float

def solve_equilibrium(T_K: float, P_Pa: float, n_C_in: float, n_H_in: float, n_O_in: float, n_N_in: float):
    # K1: CH4 + H2O <-> CO + 3H2  (+206 kJ/mol)
    log_K1 = -26830 / T_K + 30.114
    K1 = math.exp(log_K1)
    
    # K2: CO + H2O <-> CO2 + H2   (-41 kJ/mol)
    log_K2 = 4400 / T_K - 4.036
    K2 = math.exp(log_K2)
    
    def objective(vars):
        CH4, H2O, CO, CO2, H2 = vars
        
        # Penalize negative species
        penalty = sum(1e6 * (v**2) for v in vars if v < 0)
                
        C_err = (CH4 + CO + CO2 - n_C_in)**2
        H_err = (4*CH4 + 2*H2O + 2*H2 - n_H_in)**2
        O_err = (H2O + CO + 2*CO2 - n_O_in)**2
        
        n_tot = CH4 + H2O + CO + CO2 + H2 + n_N_in
        P_atm = P_Pa / 101325.0
        
        p_CH4 = (max(CH4, 1e-10) / n_tot) * P_atm
        p_H2O = (max(H2O, 1e-10) / n_tot) * P_atm
        p_CO  = (max(CO, 1e-10) / n_tot) * P_atm
        p_CO2 = (max(CO2, 1e-10) / n_tot) * P_atm
        p_H2  = (max(H2, 1e-10) / n_tot) * P_atm
        
        # SMR: K1 = (P_CO * P_H2^3) / (P_CH4 * P_H2O)
        eq1 = (p_CO * p_H2**3) / (p_CH4 * p_H2O) - K1
        # WGS: K2 = (P_CO2 * P_H2) / (P_CO * P_H2O)
        eq2 = (p_CO2 * p_H2) / (p_CO * p_H2O) - K2
        
        return C_err*1e5 + H_err*1e5 + O_err*1e5 + eq1**2 + eq2**2 + penalty

    # Initial guess: mostly shifted to products
    x0 = [n_C_in*0.05, n_O_in*0.4, n_C_in*0.4, n_C_in*0.5, n_H_in*0.4]
    bnds = ((1e-5, n_C_in), (1e-5, n_O_in), (1e-5, n_C_in), (1e-5, n_C_in), (1e-5, n_H_in))
    
    res = minimize(objective, x0, bounds=bnds, method='L-BFGS-B', options={'ftol': 1e-9})
    CH4, H2O, CO, CO2, H2 = res.x
    n_tot = CH4 + H2O + CO + CO2 + H2 + n_N_in
    
    return {
        "H2": H2/n_tot,
        "CO": CO/n_tot,
        "CO2": CO2/n_tot,
        "CH4": CH4/n_tot,
        "H2O": H2O/n_tot,
        "N2": n_N_in/n_tot,
        "CH4_conversion": max(0.0, 1.0 - (CH4 / n_C_in)) if n_C_in > 0 else 0.0,
        "CH4_CO_ratio": (CH4 / CO) if CO > 1e-5 else 999.0
    }

@app.post("/api/reformer/equilibrium", response_model=EquilibriumResult)
def calculate_equilibrium(data: ReformerInput):
    total_pct = data.CH4 + data.C2H6 + data.C3H8 + data.CO2 + data.N2
    if total_pct == 0: total_pct = 1.0
    
    # Mole fractions
    ch4_m = data.CH4 / total_pct
    c2h6_m = data.C2H6 / total_pct
    c3h8_m = data.C3H8 / total_pct
    co2_m = data.CO2 / total_pct
    n2_m = data.N2 / total_pct
    
    # Assume 100 moles of dry gas input for calculation basis
    basis = 100.0
    
    # Total Carbon in dry gas
    n_C_in = (ch4_m * 1 + c2h6_m * 2 + c3h8_m * 3 + co2_m * 1) * basis
    
    # Total Steam added (based on S/C ratio)
    steam_moles = n_C_in * data.SC_ratio
    
    # Total H in dry gas + steam
    n_H_in = (ch4_m * 4 + c2h6_m * 6 + c3h8_m * 8) * basis + steam_moles * 2
    
    # Total O in dry gas + steam
    n_O_in = (co2_m * 2) * basis + steam_moles * 1
    
    n_N_in = n2_m * 2 * basis
    
    T_K = data.T_C + 273.15
    P_Pa = data.P_kPa * 1000.0
    
    result = solve_equilibrium(T_K, P_Pa, n_C_in, n_H_in, n_O_in, n_N_in)
    return result

@app.get("/health")
def health():
    return {"status": "ok", "service": "Bosal Chemistry Engine"}
