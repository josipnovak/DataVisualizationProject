const sliderSeasons = [
    {name: "20_21", label: "20/21"},
    {name: "21_22", label: "21/22"},
    {name: "22_23", label: "22/23"},
    {name: "23_24", label: "23/24"},
    {name: "24_25", label: "24/25"}
];
const seasons = [
    {name: "20_21", file: "data/20_21.json"},
    {name: "21_22", file: "data/21_22.json"},
    {name: "22_23", file: "data/22_23.json"},
    {name: "23_24", file: "data/23_24.json"},
    {name: "24_25", file: "data/24_25.json"}
];

const leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const metrics = {
    goals: "Golovi",
    averageAge: "Prosječna dob",
    foreignPlayers: "Strani igrači",
    annualWageBillEUR: "Ukupna plaća",
    totalMarketValue: "Ukupna tržišna vrijednost"
};

const countryToLeague = {
    "France": "Ligue 1",
    "Spain": "La Liga",
    "Italy": "Serie A",
    "Germany": "Bundesliga",
    "United Kingdom": "Premier League",
    "England": "Premier League"
};

let seasonLeagueData = {};
let latestSeason = seasons[seasons.length - 1].name;
let selectedSeason = latestSeason;
let selectedLeague = leagues[0];
let selectedMetric = "annualWageBillEUR";
let isCountryView = false;
let selectedCountry = null;
let countryTableSort = { col: null, asc: true };

function populateDropdowns() {
    const seasonSelect = d3.select("#seasonSelect");
    seasonSelect.selectAll("option")
        .data(seasons)
        .enter()
        .append("option")
        .attr("value", d => d.name)
        .text(d => d.name.replace("_", "/"));

    seasonSelect.property("value", selectedSeason);

    const leagueSelect = d3.select("#leagueSelect");
    leagueSelect.selectAll("option")
        .data(leagues)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    leagueSelect.property("value", selectedLeague);
}

function loadAllSeasonData(callback) {
    let loaded = 0;
    seasons.forEach(season => {
        d3.json(season.file, function(error, data) {
            if (!error) {
                seasonLeagueData[season.name] = {};
                leagues.forEach(league => {
                    const clubs = data[league];
                    seasonLeagueData[season.name][league] = {
                        goals: d3.sum(clubs, d => d.goals),
                        averageAge: d3.mean(clubs, d => d.averageAge).toFixed(2),
                        foreignPlayers: d3.sum(clubs, d => d.foreignPlayers),
                        annualWageBillEUR: d3.sum(clubs, d => d.annualWageBillEUR),
                        totalMarketValue: d3.sum(clubs, d => d.totalMarketValue)
                    };
                });
            }
            loaded++;
            if (loaded === seasons.length) callback();
        });
    });
}

function resetToDefaultView() {
    isCountryView = false;
    selectedCountry = null;
    window.clubCompareMode = null;
    
    d3.select("#map svg g")
        .transition()
        .duration(750)
        .attr("transform", "translate(0,0)scale(1)");
    
    d3.select("#countryInfo").remove();
    
    d3.select("#charts").classed("country-view", false);
    
    d3.select("#charts").html(`
        <div id="tooltip" style="position:fixed; pointer-events:none; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px 12px; font-size:14px; display:none; z-index:10000;"></div>
        <div class="selectors">
            <div id="metricButtons" style="display:inline-block;">
                <button class="metric-btn" data-metric="goals">Golovi</button>
                <button class="metric-btn" data-metric="averageAge">Prosječna dob</button>
                <button class="metric-btn" data-metric="foreignPlayers">Strani igrači</button>
                <button class="metric-btn" data-metric="annualWageBillEUR">Ukupna plaća</button>
            </div>
        </div>
        <div id="seasonLineChart" class="chart"></div>
        <div id="stackedAreaChart" class="chart"></div>
    `);
    
    d3.selectAll(".metric-btn").on("click", function() {
        const metric = d3.select(this).attr("data-metric");
        selectedMetric = metric;
        d3.selectAll(".metric-btn").classed("active", false);
        d3.select(this).classed("active", true);
        drawLineChart(selectedMetric);
    });
    
    d3.select('.metric-btn[data-metric="' + selectedMetric + '"]').classed("active", true);
    let g = d3.select("#map svg g");
    g.selectAll(".club-dot").remove();
    drawLineChart(selectedMetric);
    drawStackedAreaChart();
    drawAllClubsOnMap(selectedSeason);
}

function drawCountrySpecificCharts(country, league, season) {
    d3.select("#charts").classed("country-view", true);
    
    d3.select("#charts").html(`
        <div id="tooltip" style="position:fixed; pointer-events:none; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px 12px; font-size:14px; display:none; z-index:10000;"></div>
        <div class="country-header">
            Sezona ${season.replace("_", "/")} ${league}
            <button class="close-btn" id="closeCountryView">X</button>
        </div>
        <div style="display:flex; gap:10px; justify-content:center; margin-bottom:10px;">
            <button class="metric-btn" data-metric="goals">Golovi</button>
            <button class="metric-btn" data-metric="totalMarketValue">Vrijednost</button>
            <button class="metric-btn" data-metric="averageAge">Prosječna dob</button>
            <button class="metric-btn" data-metric="wins">Pobjede</button>
            <button id="showTable" class="metric-btn">Prikaži tablicu</button>
        </div>
        <div id="countryBarChart"></div>
        <div id="countryTable"></div>
        <div id="countryScatterChart"></div>
    `);
    
    d3.select("#closeCountryView").on("click", resetToDefaultView);

    d3.select('.metric-btn[data-metric="goals"]').classed("active", true);


    d3.selectAll(".metric-btn").on("click", function() {
        const metric = d3.select(this).attr("data-metric");
        d3.selectAll(".metric-btn").classed("active", false);
        d3.select(this).classed("active", true);
        if (metric) {
            drawCountryBarChart(country, league, season, metric, false);
        } else {
            drawCountryBarChart(country, league, season, "selectedMetric", true);
        }
    });
    
    drawCountryBarChart(country, league, season);
    drawCountryScatterChart(country, league, season);
}

function drawCountryBarChart(country, league, season, metric="goals", table = false) {
    d3.json(`data/${season}.json`, function(error, data) {
        if (error || !data[league]) return;
        let clubs = data[league]
            .sort((a, b) => b[metric] - a[metric]);

        const margin = { top: 20, right: 30, bottom: 60, left: 60 };
        const width = 400 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        const legendWidth = 30, legendHeight = 150;

        if(!table){
            clubs = clubs.slice(0, 5); 

            d3.select("#countryTable").html("");
            d3.select("#countryBarChart").html("");

            const svg = d3.select("#countryBarChart")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const x = d3.scale.linear()
                .domain([0, d3.max(clubs, d => d[metric])])
                .range([0, width]);

            const y = d3.scale.ordinal()
                .domain(clubs.map(d => d.club))
                .rangeRoundBands([0, height], 0.1);

            svg.append("g")
                .attr("class", "axis")
                .attr("transform", `translate(0,${height})`)
                .call(
                    d3.svg.axis()
                        .scale(x)
                        .orient("bottom")
                        .ticks( x.ticks().length / 2 )
                        .tickFormat(function(d) {
                            if (d >= 1e9) return (d / 1e9) + " mlrd";
                            if (d >= 1e6) return (d / 1e6) + "M";
                            return d;
                        })
                )
                .selectAll("text");

            svg.append("g")
                .attr("class", "axis")
                .call(d3.svg.axis().scale(y).orient("left"))
                .selectAll("text")
                .style("font-size", "10px")
                .text(function(d) {
                    return d.length > 8 ? d.substring(0, 8) + "..." : d;
                })
                .on("mouseover", function(d, i) {
                    d3.select(this).style("opacity", 0.8);
                    d3.select("#tooltip")
                        .style("display", "block")
                        .html(`${d}`);
                })
                .on("mousemove", function() {
                    d3.select("#tooltip")
                        .style("left", (d3.event.pageX + 15) + "px")
                        .style("top", (d3.event.pageY - 20) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).style("opacity", 1);
                    d3.select("#tooltip").style("display", "none");
                });

        
            const bars = svg.selectAll(".bar")
                .data(clubs)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("y", d => y(d.club))
                .attr("x", 0)
                .attr("height", y.rangeBand())
                .attr("width", 0)
                .attr("fill", "#2e7d32");

            bars.transition()
                .duration(1000)
                .attr("width", d => x(d[metric]));

            svg.selectAll(".bar-label")
                .data(clubs)
                .enter().append("text")
                .attr("class", "bar-label")
                .attr("y", d => y(d.club) + y.rangeBand() / 2 + 4)
                .attr("x", d => x(d[metric]) + 5)
                .text(d => {
                    if (d[metric] >= 1e9) return (d[metric] / 1e9) + " mlrd";
                    if (d[metric] >= 1e6) return (d[metric] / 1e6) + " mil";
                    return d[metric];
            })
                .style("fill", "black")
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
            

            bars.on("mouseover", function(d, i) {
                d3.select(this).style("opacity", 0.8);
                d3.select("#tooltip")
                    .style("display", "block")
                    .html(`<strong>${d.club}</strong><br>${metrics[metric] || metric}: ${d[metric].toLocaleString()}`);
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                    .style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("opacity", 1);
                d3.select("#tooltip").style("display", "none");
            });
    } else {
        const columns = [
            { label: "Klub", key: "club" },
            { label: "Golovi", key: "goals" },
            { label: "Prosječna dob", key: "averageAge" },
            { label: "Strani igrači", key: "foreignPlayers" },
            { label: "Ukupna plaća", key: "annualWageBillEUR" },
            { label: "Tržišna vrijednost", key: "totalMarketValue" },
            { label: "Pozicija", key: "position" },
            { label: "Bodovi", key: "points" }
        ];

        clubs.forEach(d => d.points = calculatePoints(d.wins, d.draws, d.losses));

        if (countryTableSort.col) {
            clubs.sort((a, b) => {
                let v1 = a[countryTableSort.col], v2 = b[countryTableSort.col];
                if (v1 == null) v1 = -Infinity;
                if (v2 == null) v2 = -Infinity;
                if (typeof v1 === "string") {
                    return countryTableSort.asc ? v1.localeCompare(v2) : v2.localeCompare(v1);
                }
                return countryTableSort.asc ? v1 - v2 : v2 - v1;
            });
        } else {
            clubs.sort((a, b) => a.position - b.position);
        }

        d3.select("#countryBarChart").html("");
        d3.select("#countryTable").html(`
            <div id="countryTableWrapper" style="max-height:250px;overflow-y:auto;position:relative;">
            </div>
        `);

        const table = d3.select("#countryTableWrapper")
            .append("table")
            .attr("class", "country-table")
            .style("width", "100%")
            .style("border-collapse", "collapse");

        const thead = table.append("thead");
        const tbody = table.append("tbody");

        const header = thead.append("tr")
            .selectAll("th")
            .data(columns)
            .enter()
            .append("th")
            .text(d => d.label)
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("background-color", "#4caf50")
            .style("color", "white")
            .style("padding", "8px 12px")
            .style("text-align", "center")
            .style("position", "sticky")
            .style("top", "0")
            .style("z-index", "2")
            .style("cursor", "pointer")
            .on("click", function(d) {
                if (countryTableSort.col === d.key) {
                    countryTableSort.asc = !countryTableSort.asc;
                } else {
                    countryTableSort.col = d.key;
                    countryTableSort.asc = true;
                }
                drawCountryBarChart(country, league, season, "", true);
            })
            .append("span")
            .html(d => {
                if (countryTableSort.col === d.key) {
                    return countryTableSort.asc ? " ▲" : " ▼";
                }
                return "";
            });

        const rows = tbody.selectAll("tr")
            .data(clubs)
            .enter()
            .append("tr");

        rows.selectAll("td")
            .data(d => [
                d.club,
                d.goals,
                d.averageAge ? d.averageAge.toFixed(2) : "N/A",
                d.foreignPlayers,
                d.annualWageBillEUR ? (d.annualWageBillEUR / 1e6).toFixed(2) + "M" : "N/A",
                d.totalMarketValue ? (d.totalMarketValue / 1e6).toFixed(2) + "M" : "N/A",
                d.position ? d.position : "N/A",
                d.points ? d.points : "N/A"
            ])
            .enter()
            .append("td")
            .text(d => d)
            .style("font-size", "12px")
            .style("padding", "8px 12px")
            .style("text-align", "center")
            .style("border-bottom", "1px solid #ddd")
            .style("color", "#333");
    }
});
}

function drawCountryScatterChart(country, league, season) {
    d3.json(`data/${season}.json`, function(error, data) {
        if (error || !data[league]) return;
        
        const clubs = data[league];
        
        const margin = { top: 20, right: 30, bottom: 50, left: 80 };
        const width = 400 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;
        const minPos = d3.min(clubs, d => d.position);
        const maxPos = d3.max(clubs, d => d.position);

        d3.select("#countryScatterChart").html("");

        const svg = d3.select("#countryScatterChart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scale.linear()
            .domain([0, d3.max(clubs, d => d.totalMarketValue)])
            .range([0, width]);

        const y = d3.scale.linear()
            .domain([0, d3.max(clubs, d => d.annualWageBillEUR)])
            .range([height, 0]);

        const colorScale = d3.scale.linear()
            .domain([minPos, maxPos])
            .range(["#fff", "#000"]); 

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.svg.axis().scale(x).orient("bottom").ticks(Math.ceil((y.domain()[1] - y.domain()[0]) / 50000000)).tickFormat(function(d) {
                if (d >= 1e6) return (d / 1e6) + "M";
                if (d >= 1e3) return (d / 1e3) + "K";
                return d;
            }))
            .selectAll;

        svg.append("g")
            .attr("class", "axis")
            .call(d3.svg.axis().scale(y).orient("left").tickFormat(function(d) {
                if (d >= 1e6) return (d / 1e6) + "M";
                if (d >= 1e3) return (d / 1e3) + "K";
                return d;
            }));


        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text("Tržišna vrijednost");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -50)
            .attr("x", -height / 2)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text("Ukupna plaća");

        const circles = svg.selectAll(".dot")
            .data(clubs)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("r", 0)
            .attr("cx", d => x(d.totalMarketValue))
            .attr("cy", d => y(d.annualWageBillEUR))
            .attr("fill", d=> colorScale(d.position))
            .attr("opacity", 1)
            .style("cursor", "pointer");

        circles.transition()
            .duration(800)
            .delay((d, i) => i * 100)
            .attr("r", 6);

        circles.on("mouseover", function(d, i) {
            d3.select(this)
                .transition()
                .duration(100)
                .attr("r", 8)
                .attr("opacity", 1);
            
            d3.select("#tooltip")
                .style("display", "block")
                .style("opacity", 1)
                .html(`<strong>${d.club}</strong><br>Pozicija: ${d.position}<br>Tržišna vrijednost: ${d.totalMarketValue ? d.totalMarketValue.toLocaleString() : 'N/A'}<br>Ukupna plaća: ${d.annualWageBillEUR ? d.annualWageBillEUR.toLocaleString() : 'N/A'}<br>Golovi: ${d.goals || 'N/A'}`);
        })
        .on("mousemove", function(d) {
            d3.select("#tooltip")
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .transition()
                .duration(100)
                .attr("r", 6)
                .attr("opacity", 0.8);
            
            d3.select("#tooltip")
                .style("display", "none")
                .style("opacity", 0);
        });
    });
}

function drawClubSpecificCharts(club, season){
    d3.select("#charts").classed("country-view", true);
    
    d3.select("#charts").html(`
        <div id="tooltip" style="position:fixed; pointer-events:none; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px 12px; font-size:14px; display:none; z-index:10000;"></div>
        <div class="country-header"">
            <button class="compare-btn" id="compareClubBtn" style="margin-left:20px; background:#0b762d; color:white; border:none; border-radius:5px; padding:6px 14px; font-size:15px; cursor:pointer;">Usporedi</button>
            Sezona ${season.replace("_", "/")} ${club.club}
            <button class="close-btn" id="closeCountryView">X</button>

        </div>
        <div id="clubPieChart"></div>
        <div id="clubPositionLineChart"></div>
    `);

    d3.select("#closeCountryView").on("click", resetToDefaultView);
    
    drawClubPieChart(club);
    drawClubPositionLineChart(club.club);

    d3.select("#compareClubBtn").on("click", function() {
        startClubCompareMode(club);
    });
}

function drawClubPieChart(club) {
    const pieData = [
        { label: "Pobjede", value: club.wins, color: "#388e3c" },
        { label: "Neriješeno", value: club.draws, color: "#fbc02d" },
        { label: "Porazi", value: club.losses, color: "#d32f2f" }
    ];

    const width = 500, height = 220, radius = Math.min(300, height) / 2 - 10;

    d3.select("#clubPieChart").html(""); 

    const svg = d3.select("#clubPieChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${150},${height / 2})`);

    const pie = d3.layout.pie()
        .sort(null)
        .value(d => d.value);

    const arc = d3.svg.arc()
        .outerRadius(radius)
        .innerRadius(40);

    const arcs = svg.selectAll(".arc")
        .data(pie(pieData))
        .enter().append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => d.data.color)
        .style("opacity", 1)
        .transition()
        .duration(800)
        .attrTween("d", function(d) {
        const i = d3.interpolate(
            { startAngle: d.startAngle, endAngle: d.startAngle },
            d
        );
        return function(t) {
            return arc(i(t));
        };
    });

    arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("fill", "#222")
        .text(d => d.data.value);

    const legend = svg.selectAll(".legend")
        .data(pieData)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(80,${i * 28 - 40})`);

    legend.append("rect")
        .attr("x", radius + 40)
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", d => d.color);

    legend.append("text")
        .attr("x", radius + 64)
        .attr("y", 13)
        .style("font-size", "15px")
        .text(d => d.label);
}

function drawClubPositionLineChart(clubName) {
    const data = [];
    let loaded = 0;

    seasons.forEach(season => {
        d3.json(`data/${season.name}.json`, function(error, seasonData) {
            let found = false;
            if (!error) {
                for (const league of leagues) {
                    if (seasonData[league]) {
                        const club = seasonData[league].find(d => d.club === clubName);
                        if (club) {
                            data.push({
                                season: season.label || season.name.replace("_", "/"),
                                position: club.position,
                                points: calculatePoints(club.wins, club.draws, club.losses),
                                played: true
                            });
                            found = true;
                            break;
                        }
                    }
                }
            }
            if (!found) {
                data.push({
                    season: season.label || season.name.replace("_", "/"),
                    position: null,
                    points: null,
                    played: false
                });
            }
            loaded++;
            if (loaded === seasons.length) {
                data.sort((a, b) => a.season.localeCompare(b.season));
                render();
            }
        });
    });

    function render() {
        const margin = {top: 50, right: 30, bottom: 50, left: 50};
        const width = 350 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        d3.select("#clubPositionLineChart").html("");
        const svg = d3.select("#clubPositionLineChart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scale.ordinal()
            .domain(data.map(d => d.season))
            .rangePoints([0, width]);

        const y = d3.scale.linear()
            .domain([20, 1])
            .range([height, 0]);

        const line = d3.svg.line()
            .defined(d => d.position !== null)
            .x(d => x(d.season))
            .y(d => y(d.position));

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#0b762d")
            .attr("stroke-width", 3)
            .attr("d", line)
            .each(function(d) {
                const totalLength = this.getTotalLength();
                d3.select(this)
                    .attr("stroke-dasharray", totalLength + " " + totalLength)
                    .attr("stroke-dashoffset", totalLength)
                    .transition()
                    .duration(1200)
                    .ease("linear")
                    .attr("stroke-dashoffset", 0);
            });

        svg.selectAll("circle")
            .data(data)
            .enter().append("circle")
            .attr("cx", d => x(d.season))
            .attr("cy", d => d.position !== null ? y(d.position) : height + 10)
            .attr("r", d => d.position !== null ? 4 : 0)
            .attr("fill", "#0b762d")
            .attr("opacity", d => d.position !== null ? 1 : 0)
            .on("mouseover", function(d) {
                if (d.position !== null) {
                    d3.select("#tooltip")
                        .style("display", "block")
                        .html(`<strong>Sezona:</strong> ${d.season}<br><strong>Pozicija:</strong> ${d.position}<br><strong>Bodovi:</strong> ${d.points}`);
                } else {
                    d3.select("#tooltip")
                        .style("display", "block")
                        .html(`<strong>Sezona:</strong> ${d.season}<br><span style="color:#d32f2f;">Nije sudjelovao</span>`);
                }
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                    .style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip").style("display", "none");
            });

        svg.selectAll(".missing-cross")
            .data(data.filter(d => d.position === null))
            .enter()
            .append("text")
            .attr("class", "missing-cross")
            .attr("x", d => x(d.season))
            .attr("y", height + 5)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("fill", "#d32f2f")
            .text("×")
            .on("mouseover", function(d) {
                d3.select("#tooltip")
                    .style("display", "block")
                    .html(`<strong>Sezona:</strong> ${d.season}<br><span style="color:#d32f2f;">Nije sudjelovao</span>`);
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                    .style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip").style("display", "none");
            });

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.svg.axis().scale(x).orient("bottom"));

        svg.append("g")
            .call(
                d3.svg.axis()
                    .scale(y)
                    .orient("left")
                    .ticks(y.ticks().length / 1)
            );

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -25)
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .attr("fill", "#222")
            .text("Pozicije kroz sezone")
            .style("font-weight", "bold");
    }
}

function startClubCompareMode(club){
    isCountryView = false;
    selectedCountry = null;
    d3.select("#charts").classed("country-view", true);

    d3.select("#charts").html(`
        <div class="country-header"; color:white;">
            Odaberite državu i klub za usporedbu s <b>${club.club}</b>
        </div>
        <div id="compareClubsList"></div>
    `);
    d3.select("#map svg g")
        .transition()
        .duration(750)
        .attr("transform", "translate(0,0)scale(1)");
    drawAllClubsOnMap(selectedSeason);
    club.year = selectedSeason;
    window.clubCompareMode = {club};
}

function showClubComparison(club1, club2) {
    club2.year = selectedSeason;
    d3.select("#charts").html(`
        <div id="tooltip" style="position:fixed; pointer-events:none; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px 12px; font-size:14px; display:none; z-index:10000;"></div>
        <div class="country-header">
            Usporedba
            <button class="close-btn" id="closeCountryView">X</button>
        </div>
        <div<div style="display:flex; gap:60px; align-items:center; margin-bottom:10px; flex-direction:column;">
            <div style="display: flex; flex-direction: row; justify-content: center; gap: 40px;">
                <div style="text-align:center;">
                    <img src="${club1.logo}" width="60"><br>
                    <b>${club1.club}</b>
                    <b>(${club1.year.replace("_", "/")})</b>
                    <div style="margin-top:6px;">
                        <span style="display:inline-block;width:22px;height:10px;background:#fc3d03;border-radius:3px;"></span>
                    </div>
                </div>
                <div style="text-align:center;">
                    <img src="${club2.logo}" width="60"><br>
                    <b>${club2.club}</b>
                    <b>(${club2.year.replace("_", "/")})</b>
                    <div style="margin-top:6px;">
                        <span style="display:inline-block;width:22px;height:10px;background:#1976d2;border-radius:3px;"></span>
                    </div>
                </div>
            </div>
        </div>
        <div id="spiderCompare"></div>
    </div>
        </div>
    `);
    d3.select("#closeCountryView").on("click", resetToDefaultView);
    console.log(club1, club2);
    const metrics = [
        { key: "goals", label: "Golovi" },
        { key: "wins", label: "Pobjede" },
        { key: "losses", label: "Porazi" },
        { key: "totalMarketValue", label: "Vrijednost" },
        { key: "foreignPlayers", label: "Strani igrači" },
        
    ];

    const club1Data = metrics.map(m => club1[m.key] || 0);
    const club2Data = metrics.map(m => club2[m.key] || 0);
    const maxValues = metrics.map((m, i) => Math.max(club1Data[i], club2Data[i]) * 1.1 || 1);

    drawRadarComparePlot("#spiderCompare", club1Data, club2Data, maxValues, metrics.map(m => m.label), "#fc3d03", "#1976d2");

}

function drawRadarComparePlot(selector, values1, values2, maxValues, labels, color1, color2) {
    const w = 400, h = 400, r = 110, cx = w/2, cy = h/2, n = values1.length;
    const angleSlice = (2 * Math.PI) / n;

    const scale = d3.scale.linear()
        .domain([0, 1])
        .range([0, r]);

    const normValues1 = values1.map((v, i) => v / maxValues[i]);
    const normValues2 = values2.map((v, i) => v / maxValues[i]);

    const points1 = normValues1.map((v, i) => [
        cx + scale(v) * Math.sin(i * angleSlice),
        cy - scale(v) * Math.cos(i * angleSlice)
    ]);
    const points2 = normValues2.map((v, i) => [
        cx + scale(v) * Math.sin(i * angleSlice),
        cy - scale(v) * Math.cos(i * angleSlice)
    ]);

    const svg = d3.select(selector)
        .append("svg")
        .attr("width", w)
        .attr("height", h);

    for (let level = 0.2; level <= 1; level += 0.2) {
        const gridPoints = d3.range(n).map(i => [
            cx + scale(level) * Math.sin(i * angleSlice),
            cy - scale(level) * Math.cos(i * angleSlice)
        ]);
        svg.append("polygon")
            .attr("points", gridPoints.map(d => d.join(",")).join(" "))
            .attr("stroke", "#bbb")
            .attr("fill", "none");
    }

    labels.forEach((label, i) => {
        const x = cx + (r + 24) * Math.sin(i * angleSlice);
        const y = cy - (r + 24) * Math.cos(i * angleSlice);
        svg.append("line")
            .attr("x1", cx).attr("y1", cy)
            .attr("x2", cx + r * Math.sin(i * angleSlice))
            .attr("y2", cy - r * Math.cos(i * angleSlice))
            .attr("stroke", "#888");
        svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .attr("fill", "#222")
            .text(label);
    });

    const centerPoints = d3.range(n).map(() => [cx, cy]);

    const poly1 = svg.append("polygon")
        .attr("points", centerPoints.map(d => d.join(",")).join(" "))
        .attr("fill", color1)
        .attr("fill-opacity", 0.35)
        .attr("stroke", color1)
        .attr("stroke-width", 2);

    poly1.transition()
        .duration(900)
        .attr("points", points1.map(d => d.join(",")).join(" "));

    const poly2 = svg.append("polygon")
        .attr("points", centerPoints.map(d => d.join(",")).join(" "))
        .attr("fill", color2)
        .attr("fill-opacity", 0.25)
        .attr("stroke", color2)
        .attr("stroke-width", 2);

    poly2.transition()
        .duration(900)
        .attr("points", points2.map(d => d.join(",")).join(" "));

    points1.forEach((p, i) => {
        svg.append("circle")
            .attr("cx", p[0])
            .attr("cy", p[1])
            .attr("r", 5)
            .attr("fill", color1)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .on("mouseover", function() {
                d3.select("#tooltip")
                    .style("display", "block")
                    .style("opacity", 1)
                    .html(`<strong>${labels[i]}</strong><br>${values1[i].toLocaleString()}`);
                d3.select(this).attr("r", 8);
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                    .style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip")
                    .style("display", "none")
                    .style("opacity", 0);
                d3.select(this).attr("r", 5);
            });
        svg.append("text")
            .attr("x", p[0])
            .attr("y", p[1] - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", color1)
            .text(values1[i]);
    });
    points2.forEach((p, i) => {
        svg.append("circle")
            .attr("cx", p[0])
            .attr("cy", p[1])
            .attr("r", 5)
            .attr("fill", color2)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
                        .on("mouseover", function() {
                d3.select("#tooltip")
                    .style("display", "block")
                    .style("opacity", 1)
                    .html(`<strong>${labels[i]}</strong><br>${values2[i].toLocaleString()}`);
                d3.select(this).attr("r", 8);
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                    .style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip")
                    .style("display", "none")
                    .style("opacity", 0);
                d3.select(this).attr("r", 5);
            });
        svg.append("text")
            .attr("x", p[0])
            .attr("y", p[1] + 18)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", color2)
            .text(values2[i]);
    });

}

function drawMap(){
    d3.json("data/Europe.json", function(error, europe) {
        if (error) {
            d3.select("#map").html("<p>Greška pri učitavanju mape Europe.</p>");
            return;
        }
        const zoom = d3.behavior.zoom()
            .scaleExtent([1, 8])
            .on("zoom", function() {
                g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            });
        const width = 750, height = 550;
        const svg = d3.select("#map")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(
                d3.behavior.zoom()
                    .scaleExtent([1, 8])
                    .on("zoom", function() {
                        g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                    })
            );

        const projection = d3.geo.mercator()
            .center([0, 45])
            .scale(800)
            .translate([width / 2, height / 2]);

        const path = d3.geo.path().projection(projection);

        const g = svg.append("g");

        svg.call(zoom);

        g.selectAll("path")
            .data(europe.features)
            .enter().append("path")
            .attr("d", path)
            .attr("class", "country")
            .attr("fill", "#555")
            .attr("stroke", "#bdbdbd")
            .on("mouseover", function() { d3.select(this).attr("fill", "#a0a0a000"); })
            .on("mouseout", function() { d3.select(this).attr("fill", "#555"); })
            .on("click", function(d) {
                const countryName = d.properties.name || d.properties.NAME;
                const seasonName = sliderSeasons[document.getElementById("seasonSlider").value].name;
                const league = countryToLeague[countryName];
                
                if (!league) return; 
                
                isCountryView = true;
                selectedCountry = countryName;
                selectedLeague = league;
                
                var bounds = path.bounds(d),
                    dx = bounds[1][0] - bounds[0][0],
                    dy = bounds[1][1] - bounds[0][1],
                    x = (bounds[0][0] + bounds[1][0]) / 2,
                    y = (bounds[0][1] + bounds[1][1]) / 2,
                    scale = Math.max(1, Math.min(8, 0.8 / Math.max(dx / 600, dy / 700))),
                    translate = [600 / 2 - scale * x, 700 / 2 - scale * y];

                zoom.translate(translate).scale(scale)
                d3.select("#map svg g")
                    .transition()
                    .duration(750)
                    .attr("transform", "translate(" + translate + ")scale(" + scale + ")");

                let g = d3.select("#map svg g");

                g.selectAll(".club-dot").remove();
                drawClubsForSelectedSeason(seasonName,  league);
                if(!window.clubCompareMode){
                    drawCountrySpecificCharts(countryName, league, seasonName);
                }
            });
    });
}

function drawClubsForSelectedSeason(seasonName, league) {
    d3.json(`data/${selectedSeason}.json`, function(error, data) {
        if (error) return;

        let clubs = [];
        const width = 750, height = 550;
        const jitter = 15;

        const projection = d3.geo.mercator()
            .center([0, 45])
            .scale(800)
            .translate([width / 2, height / 2]);

        if (data[league]) {
            clubs = data[league].filter(club =>
                club.lat && club.lon && club.club && club.logo
            );
        }

        let g = d3.select("#map svg g");

        const clubDots = g.selectAll(".club-dot")
            .data(clubs, d => d.club); 


        clubDots.exit()
            .transition()
            .duration(400)
            .style("opacity", 0)
            .remove();


        clubDots.enter()
            .append("image")
            .attr("class", "club-dot")
            .attr("xlink:href", d => d.logo)
            .attr("x", d => projection([d.lon, d.lat])[0] - 5 + (Math.random() - 0.5) * jitter)
            .attr("y", d => projection([d.lon, d.lat])[1] - 5 + (Math.random() - 0.5) * jitter)
            .attr("height", 10)
            .attr("width", 10)
            .style("opacity", 0)
            .transition()
            .duration(400)
            .style("opacity", 1);

        clubDots.on("click", function(d) {
            if(window.clubCompareMode){
                showClubComparison(window.clubCompareMode.club, d);
            }
            else{
                drawClubSpecificCharts(d, selectedSeason);
            }
        })
    });
}

function drawAllClubsOnMap(seasonName) {
    if (isCountryView) return; 
    
    d3.json(`data/${seasonName}.json`, function(error, data) {
        if (error) return;

        let allClubs = [];
        leagues.forEach(league => {
            if (data[league]) {
                allClubs = allClubs.concat(data[league].filter(d => d.lat && d.lon));
            }
        });

        const width = 750, height = 550;
        const projection = d3.geo.mercator()
            .center([0, 45])
            .scale(800)
            .translate([width / 2, height / 2]);

        const svg = d3.select("#map svg g");
        if(svg.empty()){
            setTimeout(() => {
                drawAllClubsOnMap(seasonName);
            }, 100);
        }
        let g = d3.select("#map svg g");

        if (g.empty()) g = svg.append("g").attr("class", "club-group");

        if(window.clubCompareMode){
            g.selectAll(".club-dot").remove();
        }

        const dots = g.selectAll(".club-dot")
            .data(allClubs, d => d.club + d.lat + d.lon);

        dots.exit()
            .transition()
            .duration(500)
            .attr("r", 0)
            .style("opacity", 0)
            .remove();

        dots.transition()
            .duration(500)
            .attr("cx", d => projection([d.lon, d.lat])[0])
            .attr("cy", d => projection([d.lon, d.lat])[1])
            .attr("r", 4)
            .style("opacity", 1);

        dots.enter()
            .append("circle")
            .attr("class", "club-dot")
            .attr("cx", d => projection([d.lon, d.lat])[0])
            .attr("cy", d => projection([d.lon, d.lat])[1])
            .attr("r", 0)
            .attr("fill", "#0b762d")
            .style("opacity", 0)
            .on("mouseover", function(d) {
                d3.select("#tooltip")
                  .style("display", "block")
                  .html(`<strong>${d.club}</strong>`);
            })
            .on("mousemove", function() {
                d3.select("#tooltip")
                  .style("left", (d3.event.pageX + 15) + "px")
                  .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select("#tooltip").style("display", "none");
            })
            .transition()
            .duration(500)
            .attr("r", 4)
            .style("opacity", 1);
    });
}

function drawLineChart(metric) {
    if (isCountryView) return;
    
    const chartData = leagues.map(league => ({
        league,
        values: seasons.map(season => ({
            season: season.name,
            value: seasonLeagueData[season.name][league][metric]
        }))
    }));

    const margin = { top: 50, right: 30, bottom: 50, left: 80 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;
    const legendOffset = 150;

    d3.select("#seasonLineChart").html(""); 

    const svg = d3.select("#seasonLineChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right + legendOffset)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scale.ordinal()
        .domain(seasons.map(s => s.name))
        .rangePoints([0, width]);

    const y = d3.scale.linear()
        .domain([
            0,
            d3.max(chartData, d => d3.max(d.values, v => v.value))
        ])
        .range([height, 0]);

    const color = d3.scale.category10().domain(leagues);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .selectAll("text")
        .style("text-anchor", "middle")
        .text(d => d.replace("_", "/"));

    svg.append("g")
    .call(
        d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks( y.ticks().length / 2 )
            .tickFormat(function(d) {
                if (d >= 1e9) return (d / 1e9) + " mlrd"; 
                if (d >= 1e6) return (d / 1e6) + " mil"; 
                return d;
            })
    );

    const line = d3.svg.line()
        .x(d => x(d.season))
        .y(d => y(d.value));

svg.selectAll(".league-line")
    .data(chartData)
    .enter().append("path")
    .attr("class", "league-line")
    .attr("fill", "none")
    .attr("stroke", d => color(d.league))
    .attr("stroke-width", 2)
    .attr("d", d => line(d.values))
    .each(function(d) {
        const totalLength = this.getTotalLength();
        d3.select(this)
            .attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1200)
            .ease("linear")
            .attr("stroke-dashoffset", 0);
    })
    .on("click", function(d) {
        selectedLeague = d.league;
        d3.select("#leagueSelect").property("value", selectedLeague);
    });

    chartData.forEach(d => {
    svg.selectAll(`.dot-${d.league.replace(/\s/g, '')}`)
        .data(d.values)
        .enter().append("circle")
        .attr("cx", v => x(v.season))
        .attr("cy", v => y(v.value))
        .attr("r", 0) 
        .attr("fill", color(d.league))
        .style("cursor", "pointer")
        .on("click", function(v) {
            selectedLeague = d.league;
            selectedSeason = v.season;
        })
        .on("mouseover", function(v) {
            d3.select(this).attr("r", 6);
            d3.select("#tooltip")
                .style("display", "block")
                .html(
                    `<strong>Liga:</strong> ${d.league}<br>
                    <strong>Sezona:</strong> ${v.season.replace("_", "/")}<br>
                    <strong>${metrics[selectedMetric]}:</strong> ${v.value.toLocaleString()}`
                );
        })
        .on("mousemove", function() {
            d3.select("#tooltip")
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4);
            d3.select("#tooltip").style("display", "none");
        })
        .transition()
        .delay(1200) 
        .duration(400)
        .attr("r", 4); 
});

    const legend = svg.selectAll(".legend")
        .data(leagues)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d,i) => `translate(${width + 30},${i*22})`); 

    legend.append("rect")
        .attr("x", 0) 
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", color);

    legend.append("text")
        .attr("x", 26) 
        .attr("y", 13)
        .attr("text-anchor", "start")
        .style("font-size", "13px")
        .text(d => d);
}

function drawStackedAreaChart(metric = "totalMarketValue") {
    if (isCountryView) return;     
    const data = seasons.map(season => {
        const entry = { season: season.name };
        leagues.forEach(league => {
            entry[league] = seasonLeagueData[season.name][league][metric];
        });
        return entry;
    });

    const leagueTotals = leagues.map(league => ({
        league,
        total: d3.sum(data, d => d[league])
    }));
    const sortedLeagues = leagueTotals.sort((a, b) => a.total - b.total).map(d => d.league);

    const stack = d3.layout.stack()
        .values(d => d.values)
        .x(d => d.season)
        .y(d => d.value);

    const stackedData = stack(sortedLeagues.map(league => ({
        league,
        values: data.map(d => ({
            season: d.season,
            value: d[league]
        }))
    })));
    
    const margin = { top: 50, right: 30, bottom: 50, left: 80 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;
    const legendOffset = 150;

    d3.select("#stackedAreaChart").html("");

    const svg = d3.select("#stackedAreaChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right + legendOffset)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scale.ordinal()
        .domain(seasons.map(s => s.name))
        .rangePoints([0, width]);

    const y = d3.scale.linear()
        .domain([0, d3.max(stackedData[stackedData.length - 1].values, d => d.y0 + d.value) * 1.1])
        .range([height, 0]);

    const color = d3.scale.category10().domain(leagues);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .selectAll("text")
        .style("text-anchor", "middle")
        .text(d => d.replace("_", "/"));

    svg.append("g")
    .call(
        d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks( y.ticks().length / 2 )
            .tickFormat(function(d) {
                if (d >= 1e9) return (d / 1e9) + " mlrd"; 
                if (d >= 1e6) return (d / 1e6) + "M"; 
                return d;
            })
    );

    const area = d3.svg.area()
        .x(d => x(d.season))
        .y0(d => y(d.y0))
        .y1(d => y(d.y0 + d.value));

    svg.selectAll(".area")
        .data(stackedData)
        .enter().append("path")
        .attr("class", "area")
        .attr("fill", d => color(d.league))
        .attr("opacity", 0.8)
        .attr("d", d => area(d.values.map(v => ({...v, value: 0}))))
        .transition()
        .duration(1200)
        .attr("d", d => area(d.values));

    svg.selectAll(".area")
        .on("mouseover", function(d) {
            d3.select(this).attr("opacity", 1);
        })
        .on("mousemove", function(d) {
            const mouseX = d3.mouse(this)[0];
            const seasonNames = seasons.map(s => s.name);
            const xPositions = seasonNames.map(name => x(name));
            let minDist = Infinity, seasonIdx = 0;
            xPositions.forEach((pos, i) => {
                const dist = Math.abs(mouseX - pos);
                if (dist < minDist) {
                    minDist = dist;
                    seasonIdx = i;
                }
            });
            const season = seasonNames[seasonIdx];
            const valueObj = d.values.find(v => v.season === season);
            const value = valueObj ? valueObj.value : 0;
            d3.select("#tooltip")
                .style("display", "block")
                .html(
                    `<strong>${d.league}</strong><br>
                    Sezona: ${season.replace("_", "/")}<br>
                    Vrijednost: ${value.toLocaleString()}`
                )
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.8);
            d3.select("#tooltip").style("display", "none");
        });

    const legend = svg.selectAll(".legend")
        .data(leagues)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d,i) => `translate(${width + 30},${i*22})`); 

    legend.append("rect")
        .attr("x", 0) 
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", color);

    legend.append("text")
        .attr("x", 26) 
        .attr("y", 13)
        .attr("text-anchor", "start")
        .style("font-size", "13px")
        .text(d => d);

    svg.append("text")
            .attr("x", width / 2)
            .attr("y", -25)
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .attr("fill", "#222")
            .text("Promjena ukupne vrijednosti liga kroz sezone")
            .style("font-weight", "bold");
}

loadAllSeasonData(() => {
    populateDropdowns();
    drawLineChart(selectedMetric);
    drawStackedAreaChart();
    drawMap();
    drawAllClubsOnMap(selectedSeason);
});

d3.selectAll(".metric-btn").on("click", function() {
    const metric = d3.select(this).attr("data-metric");
    selectedMetric = metric;

    d3.selectAll(".metric-btn").classed("active", false);
    d3.select(this).classed("active", true);
    
    drawLineChart(selectedMetric);
});


d3.select('.metric-btn[data-metric="' + selectedMetric + '"]').classed("active", true);

d3.select("#seasonSlider").on("input", function() {
    const idx = +this.value;
    selectedSeason = sliderSeasons[idx].name;
    if (!isCountryView) {
        drawAllClubsOnMap(sliderSeasons[idx].name);
    }
    else{
        if(!window.clubCompareMode){
            drawCountrySpecificCharts(selectedCountry, selectedLeague, sliderSeasons[idx].name);
            drawClubsForSelectedSeason(selectedSeason, selectedLeague);
        }
        else{
            drawClubsForSelectedSeason(selectedSeason, selectedLeague);
        }
    }
});

function zoom(){
    d3.select("#map svg").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function calculatePoints(wins, draws, losses) {
    return wins * 3 + draws; 
}
