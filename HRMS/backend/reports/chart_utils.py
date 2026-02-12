"""
Server-side chart image generation using matplotlib.
Generates PNG chart images for embedding in PDF/Excel report exports.
"""

import io

import matplotlib
matplotlib.use('Agg')  # Headless rendering - must be before pyplot import
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

# Match frontend chartColors.palette from design-tokens.ts
CHART_COLORS = [
    '#22c55e',  # green/primary
    '#eab308',  # yellow/accent
    '#3b82f6',  # blue/info
    '#8b5cf6',  # purple
    '#ec4899',  # pink
    '#14b8a6',  # teal
    '#f97316',  # orange
    '#6366f1',  # indigo
]


def _get_colors(count):
    """Get a list of colors cycling through the palette."""
    colors = []
    for i in range(count):
        colors.append(CHART_COLORS[i % len(CHART_COLORS)])
    return colors


def generate_pie_chart(data, title, donut=False, center_label=None):
    """
    Generate a pie/donut chart as a PNG image.

    Args:
        data: list of dicts with 'name' and 'value' keys
        title: chart title
        donut: if True, render as donut chart with hole in center
        center_label: text to display in center of donut

    Returns:
        BytesIO PNG buffer, or None if no data
    """
    if not data or all(d.get('value', 0) == 0 for d in data):
        return None

    fig, ax = plt.subplots(figsize=(5, 4))

    labels = [d['name'] for d in data]
    values = [d['value'] for d in data]
    chart_colors = _get_colors(len(data))

    wedges, texts, autotexts = ax.pie(
        values, labels=None, autopct='%1.1f%%',
        colors=chart_colors, startangle=90,
        pctdistance=0.82 if donut else 0.5
    )

    if donut:
        centre_circle = plt.Circle((0, 0), 0.55, fc='white')
        ax.add_artist(centre_circle)
        if center_label:
            ax.text(0, 0, center_label, ha='center', va='center',
                    fontsize=14, fontweight='bold')

    for text in autotexts:
        text.set_fontsize(7)

    ax.set_title(title, fontsize=11, fontweight='bold', pad=15)
    # Limit legend to top entries to avoid overflow
    if len(labels) > 12:
        ax.legend(labels[:12] + [f'... +{len(labels) - 12} more'],
                  loc='center left', bbox_to_anchor=(1, 0.5), fontsize=7)
    else:
        ax.legend(labels, loc='center left', bbox_to_anchor=(1, 0.5), fontsize=7)

    fig.subplots_adjust(right=0.65)

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_bar_chart(data, title, horizontal=False, color=None, value_key='value'):
    """
    Generate a bar chart as a PNG image.

    Args:
        data: list of dicts with 'name' and 'value' keys
        title: chart title
        horizontal: if True, render horizontal bars
        color: override bar color
        value_key: key in data dicts for the value

    Returns:
        BytesIO PNG buffer, or None if no data
    """
    if not data:
        return None

    fig, ax = plt.subplots(figsize=(6, max(3, len(data) * 0.35) if horizontal else 4))

    labels = [str(d['name']) for d in data]
    values = [d.get(value_key, d.get('value', 0)) for d in data]
    bar_color = color or CHART_COLORS[0]

    if horizontal:
        bars = ax.barh(labels, values, color=bar_color, edgecolor='none', height=0.6)
        ax.invert_yaxis()
        ax.set_xlabel('Count')
        for bar, val in zip(bars, values):
            ax.text(bar.get_width() + max(values) * 0.02, bar.get_y() + bar.get_height() / 2,
                    f'{val:,.0f}' if isinstance(val, (int, float)) else str(val),
                    va='center', fontsize=8)
    else:
        bars = ax.bar(labels, values, color=_get_colors(len(data)), edgecolor='none', width=0.6)
        ax.set_ylabel('Count')
        plt.xticks(rotation=45, ha='right', fontsize=8)
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                    f'{val:,.0f}' if isinstance(val, (int, float)) else str(val),
                    ha='center', va='bottom', fontsize=8)

    ax.set_title(title, fontsize=11, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))

    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_line_chart(data, title, x_key='name', y_key='value'):
    """
    Generate a line chart as a PNG image.

    Args:
        data: list of dicts
        title: chart title
        x_key: key for x-axis values
        y_key: key for y-axis values

    Returns:
        BytesIO PNG buffer, or None if no data
    """
    if not data:
        return None

    fig, ax = plt.subplots(figsize=(6, 4))

    x_labels = [str(d[x_key]) for d in data]
    y_values = [d[y_key] for d in data]

    ax.plot(range(len(x_labels)), y_values, color=CHART_COLORS[0], marker='o',
            linewidth=2, markersize=5)
    ax.fill_between(range(len(x_labels)), y_values, alpha=0.1, color=CHART_COLORS[0])

    ax.set_xticks(range(len(x_labels)))
    ax.set_xticklabels(x_labels, rotation=45, ha='right', fontsize=8)

    ax.set_title(title, fontsize=11, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.set_ylabel('Count')
    ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))

    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_area_chart(data, title, x_key='name', y_key='value', fill_color=None):
    """
    Generate an area chart as a PNG image.

    Args:
        data: list of dicts
        title: chart title
        x_key: key for x-axis values
        y_key: key for y-axis values
        fill_color: override fill color

    Returns:
        BytesIO PNG buffer, or None if no data
    """
    if not data:
        return None

    fig, ax = plt.subplots(figsize=(6, 4))

    x_labels = [str(d[x_key]) for d in data]
    y_values = [d[y_key] for d in data]
    color = fill_color or CHART_COLORS[2]  # blue

    ax.fill_between(range(len(x_labels)), y_values, alpha=0.3, color=color)
    ax.plot(range(len(x_labels)), y_values, color=color, linewidth=2, marker='o', markersize=4)

    ax.set_xticks(range(len(x_labels)))
    ax.set_xticklabels(x_labels, rotation=45, ha='right', fontsize=8)

    ax.set_title(title, fontsize=11, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.set_ylabel('Count')
    ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))

    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf
