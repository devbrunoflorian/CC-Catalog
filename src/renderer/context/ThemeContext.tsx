import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeColor = 'obsidian' | 'rose-quartz' | 'sapphire' | 'diamond';

interface ThemeContextType {
    themeColor: ThemeColor;
    setThemeColor: (color: ThemeColor) => void;
    opacity: number;
    setOpacity: (opacity: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
        return (localStorage.getItem('themeColor') as ThemeColor) || 'obsidian';
    });
    const [opacity, setOpacityState] = useState<number>(() => {
        const saved = localStorage.getItem('opacity');
        return saved ? parseFloat(saved) : 0.6;
    });

    const setThemeColor = (color: ThemeColor) => {
        setThemeColorState(color);
        localStorage.setItem('themeColor', color);
    };

    const setOpacity = (val: number) => {
        setOpacityState(val);
        localStorage.setItem('opacity', val.toString());
    };

    return (
        <ThemeContext.Provider value={{ themeColor, setThemeColor, opacity, setOpacity }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
